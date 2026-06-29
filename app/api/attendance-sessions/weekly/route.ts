import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { Member } from "@/lib/supabase/database.types";

/**
 * "이번 주 출석 세션 생성" 버튼이 호출하는 API.
 *
 * 동작:
 * 1. 기존 토/일(saturday, sunday) status='open' 세션을 모두 archived로 변경
 * 2. 이번 주 토요일/일요일 날짜로 새 세션 2개를 생성
 * 3. 각 세션에 활성 회원 전체의 attendance 행을 undecided 기본값으로 생성
 *
 * 권한: manager 이상이 수행해야 하지만, 카카오 로그인/permission_role 체크가
 * 아직 도입되지 않은 단계라 우선 기존 운영진 비밀번호 인증(isAdminSession)으로 대체한다.
 * 추후 권한 시스템이 들어오면 permission_role >= manager 체크로 교체할 것.
 */

function nextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const diff = (targetDay - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const authError = requireAdmin();
  if (authError) return authError;

  const supabase = createServiceClient();
  const today = new Date();
  const saturdayDate = toDateString(nextWeekday(today, 6));
  const sundayDate = toDateString(nextWeekday(today, 0));

  // 1. 같은 날짜+구분으로 이미 open 세션이 있는지 확인 (중복 생성 방지)
  const { data: existingOpen } = await supabase
    .from("attendance_sessions")
    .select("id, session_date, session_day")
    .in("session_day", ["saturday", "sunday"])
    .eq("status", "open");

  const hasDuplicate = (existingOpen ?? []).some(
    (s) =>
      (s.session_day === "saturday" && s.session_date === saturdayDate) ||
      (s.session_day === "sunday" && s.session_date === sundayDate)
  );

  if (hasDuplicate) {
    return NextResponse.json(
      { error: "이미 해당 날짜의 출석 세션이 있습니다." },
      { status: 409 }
    );
  }

  // 2. 기존 open 상태의 토/일 세션을 archived 처리 (지난 세션 보관)
  await supabase
    .from("attendance_sessions")
    .update({ status: "archived", closed_at: new Date().toISOString() })
    .in("session_day", ["saturday", "sunday"])
    .eq("status", "open");

  // 3. 새 토요일/일요일 세션 생성
  const { data: newSessions, error: insertError } = await supabase
    .from("attendance_sessions")
    .insert([
      { session_date: saturdayDate, session_day: "saturday", title: `${saturdayDate} 토요 정기운동`, status: "open" },
      { session_date: sundayDate, session_day: "sunday", title: `${sundayDate} 일요 정기운동`, status: "open" },
    ])
    .select();

  if (insertError || !newSessions) {
    return NextResponse.json({ error: "세션 생성에 실패했습니다." }, { status: 500 });
  }

  // 4. 활성 회원 전체 조회 후, 각 세션에 undecided 기본값으로 attendance 행 생성
  const { data: activeMembers } = await supabase
    .from("members")
    .select("id")
    .eq("is_active", true);

  const members = (activeMembers ?? []) as Pick<Member, "id">[];

  const attendanceRows = newSessions.flatMap((session) =>
    members.map((m) => ({
      member_id: m.id,
      session_id: session.id,
      event_date: session.session_date,
      status: "undecided" as const,
    }))
  );

  if (attendanceRows.length > 0) {
    await supabase.from("attendance").insert(attendanceRows);
  }

  return NextResponse.json({ ok: true, sessions: newSessions });
}
