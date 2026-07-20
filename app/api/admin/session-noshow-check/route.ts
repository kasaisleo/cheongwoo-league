import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/session-noshow-check?sessionId=<uuid>
 *
 * 매치 완료(closed) 처리 전, 운영진 확인용 경고 산출 API.
 * 기존에는 AdminAttendancePageClient가 matches/attendance를 브라우저에서 직접 조회했다 —
 * PII는 아니지만(참여자 id/출석 상태만) Client direct attendance 조회를 전부 없애는
 * 이번 Phase 방침에 맞춰 서버로 옮긴다.
 *
 * clubId는 요청 쿼리로 받지 않는다 — access.clubId(admin 세션 기준)만 신뢰한다.
 */
export async function GET(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json({ error: "관리 클럽 context가 없습니다." }, { status: 400 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "sessionId가 올바르지 않습니다." }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: session, error: sessionError } = await admin
    .from("attendance_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const [{ data: matchData, error: matchError }, { data: attendData, error: attendError }] = await Promise.all([
    admin
      .from("matches")
      .select("team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member")
      .eq("session_id", sessionId)
      .eq("club_id", currentClubId),
    admin.from("attendance").select("member_id, status").eq("session_id", sessionId),
  ]);

  if (matchError || attendError) {
    console.error("[admin/session-noshow-check]", matchError ?? attendError);
    return NextResponse.json({ error: "확인 중 오류가 발생했습니다." }, { status: 500 });
  }

  const participantIds = new Set<string>();
  for (const m of matchData ?? []) {
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
      .filter(Boolean)
      .forEach((id) => participantIds.add(id as string));
  }

  const attendingIds = (attendData ?? [])
    .filter((r) => r.status === "attending")
    .map((r) => r.member_id);
  const noShowCount = attendingIds.filter((mid) => !participantIds.has(mid)).length;

  return NextResponse.json({
    hasMatches: (matchData ?? []).length > 0,
    noShowCount,
    // 아래 2개는 NewMatchPageClient의 Client direct matches 조회를 대체하기 위한
    // additive 필드 — 기존 소비처(AdminAttendancePageClient 등)는 이 필드를 몰라도
    // 무관하므로 회귀 없음. Admin 전용 응답이라 member UUID를 그대로 포함한다
    // (PII 아님, guest 슬롯은 no-show 계산 대상이 아니므로 제외).
    gameCount: (matchData ?? []).length,
    participantMemberIds: [...participantIds],
  });
}
