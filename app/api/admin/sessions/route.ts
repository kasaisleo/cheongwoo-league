import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { Member, SessionDay } from "@/lib/supabase/database.types";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

/**
 * POST /api/admin/sessions
 * 관리자 전용 매치(출석 세션) 생성 API.
 *
 * 기존 /api/attendance-sessions/custom과의 차이:
 *   - sessionDay: saturday/sunday/holiday/custom 모두 허용
 *   - sessionDate: 과거 날짜도 허용 (소급 경기 기록용)
 *   - 응답: { ok, sessionId } — 클라이언트에서 자동 선택에 사용
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { title, sessionDate, sessionDay } = await request.json() as {
    title: string;
    sessionDate: string;
    sessionDay: SessionDay;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "매치명을 입력해주세요." }, { status: 400 });
  }
  if (!sessionDate) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }
  const VALID_DAYS: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];
  if (!VALID_DAYS.includes(sessionDay)) {
    return NextResponse.json({ error: "매치 타입을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: session, error: insertError } = await supabase
    .from("attendance_sessions")
    .insert({
      session_date: sessionDate,
      session_day: sessionDay,
      title: title.trim(),
      status: "open",
      club_id: CHEONGWOO_CLUB_ID,
    })
    .select()
    .single();

  if (insertError || !session) {
    return NextResponse.json({ error: "매치 추가에 실패했습니다." }, { status: 500 });
  }

  // 활성 회원 전체의 출석 행 생성 (undecided 기본값)
  const { data: activeMembers } = await supabase
    .from("members")
    .select("id")
    .eq("is_active", true)
    .eq("club_id", CHEONGWOO_CLUB_ID);

  const members = (activeMembers ?? []) as Pick<Member, "id">[];
  if (members.length > 0) {
    await supabase.from("attendance").insert(
      members.map((m) => ({
        member_id: m.id,
        session_id: session.id,
        event_date: session.session_date,
        status: "undecided" as const,
      }))
    );
  }

  return NextResponse.json({ ok: true, sessionId: session.id });
}
