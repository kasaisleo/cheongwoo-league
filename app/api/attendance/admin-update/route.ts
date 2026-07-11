import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { AttendanceStatus } from "@/lib/supabase/database.types";

interface AdminUpdateAttendanceBody {
  memberId: string;
  sessionId: string;
  status: AttendanceStatus;
}

const VALID_STATUSES: AttendanceStatus[] = ["attending", "absent", "undecided"];

/**
 * 운영진이 출석 상태를 보정하는 API.
 *
 * 세션 상태별 동작:
 * - open: 일반 회원도 RLS로 직접 upsert 가능하지만, 운영진도 이 API로 처리 가능
 * - closed: 일반 회원은 RLS로 차단됨. 운영진은 이 API(service-role)로만 보정 가능
 * - archived: 보관된 세션은 읽기 전용. 운영진도 이 API로 수정할 수 없도록 차단한다.
 *
 * 권한: manager 이상이 보정해야 하지만, 권한 시스템 도입 전이라 운영진 비밀번호
 * 인증(isAdminSession)으로 대체한다.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json({ error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." }, { status: 400 });
  }

  const body = (await request.json()) as AdminUpdateAttendanceBody;
  const { memberId, sessionId, status } = body;

  if (!memberId || !sessionId) {
    return NextResponse.json({ error: "회원 또는 세션 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "출석 상태가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // service role은 RLS를 우회하므로, session이 access.clubId 소속인지 명시적으로 검증한다.
  // memberId도 같은 club 소속인지 함께 확인해 cross-club upsert를 차단한다.
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, status, session_date")
    .eq("id", sessionId)
    .eq("club_id", currentClubId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.status === "archived") {
    return NextResponse.json(
      { error: "보관된 세션은 읽기 전용이라 수정할 수 없습니다." },
      { status: 400 }
    );
  }

  const { data, error: upsertError } = await supabase
    .from("attendance")
    .upsert(
      {
        member_id: memberId,
        session_id: sessionId,
        event_date: session.session_date,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,session_id" }
    )
    .select()
    .single();

  if (upsertError || !data) {
    return NextResponse.json({ error: "출석 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, attendance: data });
}
