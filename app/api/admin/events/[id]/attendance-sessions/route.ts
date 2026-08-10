import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/events/[id]/attendance-sessions
 *
 * 출석 명단 가져오기(2A-4B)용 후보 세션 목록. 기존 /api/attendance/public-sessions는
 * clubId를 query에서 그대로 신뢰하는 공개용 계약이라 이 Admin 흐름에서는 재사용하지
 * 않는다 — access.clubId로만 스코프하는 전용 read endpoint.
 *
 * open/closed만 노출(archived는 이번 phase 범위 밖). event_date와 다른 세션도
 * 선택 가능해야 하므로 날짜 필터는 두지 않는다(0052 설계 의도).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", params.id)
    .eq("club_id", access.clubId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("attendance_sessions")
    .select("id, session_date, session_day, title, status")
    .eq("club_id", access.clubId)
    .in("status", ["open", "closed"])
    .order("session_date", { ascending: false });

  if (sessionsError) {
    console.error("[admin/events/:id/attendance-sessions GET]", sessionsError.code, sessionsError.message);
    return NextResponse.json({ error: "출석 세션 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // attendance/roster route.ts와 동일한 패턴 — raw row를 가져와 JS에서 세션별로 집계.
  const [{ data: attendanceRows }, { data: guestRows }] = await Promise.all([
    supabase
      .from("attendance")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "attending"),
    supabase.from("session_guests").select("session_id").in("session_id", sessionIds),
  ]);

  const attendingCountBySession = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendingCountBySession.set(row.session_id, (attendingCountBySession.get(row.session_id) ?? 0) + 1);
  }
  const guestCountBySession = new Map<string, number>();
  for (const row of guestRows ?? []) {
    guestCountBySession.set(row.session_id, (guestCountBySession.get(row.session_id) ?? 0) + 1);
  }

  const result = (sessions ?? []).map((s) => ({
    ...s,
    attendingCount: attendingCountBySession.get(s.id) ?? 0,
    guestCount: guestCountBySession.get(s.id) ?? 0,
  }));

  return NextResponse.json({ sessions: result });
}
