import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: { id: string };
}

interface PlayerRelation {
  id: string;
  name: string;
}

interface MatchRow {
  id: string;
  played_at: string;
  session_id: string | null;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: "A" | "B";
  team_a_player1_member_row: PlayerRelation | null;
  team_a_player1_guest_row: PlayerRelation | null;
  team_a_player2_member_row: PlayerRelation | null;
  team_a_player2_guest_row: PlayerRelation | null;
  team_b_player1_member_row: PlayerRelation | null;
  team_b_player1_guest_row: PlayerRelation | null;
  team_b_player2_member_row: PlayerRelation | null;
  team_b_player2_guest_row: PlayerRelation | null;
}

interface PublicSlot {
  id: string;
  name: string;
  isGuest: boolean;
}

function resolveSlot(memberRow: PlayerRelation | null, guestRow: PlayerRelation | null): PublicSlot {
  if (memberRow) return { id: memberRow.id, name: memberRow.name, isGuest: false };
  if (guestRow) return { id: guestRow.id, name: guestRow.name, isGuest: true };
  return { id: "", name: "알수없음", isGuest: false };
}

/**
 * GET /api/matches/[id]/edit-detail
 *
 * Admin 전용 — EditMatchModal이 모달을 열 때만 호출해 원본 participant id를
 * 가져오기 위한 API. Public MatchCard/PublicDisplayMatch에는 participant UUID를
 * 전혀 포함하지 않으므로, 실제 수정 폼 초기화는 이 API를 거쳐야만 가능하다.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!access.clubId) {
    return NextResponse.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });
  }

  const matchId = params.id;
  if (!UUID_RE.test(matchId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const admin = createServiceClient();
  const currentClubId = access.clubId;

  const { data: match, error: matchError } = await admin
    .from("matches")
    .select(
      `
      id, played_at, session_id, score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team,
      team_a_player1_member_row:members!matches_team_a_player1_member_fkey(id, name),
      team_a_player1_guest_row:guests!matches_team_a_player1_guest_fkey(id, name),
      team_a_player2_member_row:members!matches_team_a_player2_member_fkey(id, name),
      team_a_player2_guest_row:guests!matches_team_a_player2_guest_fkey(id, name),
      team_b_player1_member_row:members!matches_team_b_player1_member_fkey(id, name),
      team_b_player1_guest_row:guests!matches_team_b_player1_guest_fkey(id, name),
      team_b_player2_member_row:members!matches_team_b_player2_member_fkey(id, name),
      team_b_player2_guest_row:guests!matches_team_b_player2_guest_fkey(id, name)
    `
    )
    .eq("id", matchId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (matchError) {
    console.error("[matches/edit-detail]", matchError.code, matchError.message);
    return NextResponse.json({ error: "경기 조회 실패" }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });
  }

  const row = match as unknown as MatchRow;

  // session_id가 있으면 이 클럽 소속 세션인지 재검증한다 — matches.club_id
  // 조건만으로도 사실상 보장되지만, FK/embed 결과만 신뢰하지 않는다.
  if (row.session_id) {
    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .select("id")
      .eq("id", row.session_id)
      .eq("club_id", currentClubId)
      .maybeSingle();

    if (sessionError) {
      console.error("[matches/edit-detail]", sessionError.code, sessionError.message);
      return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "세션 정보가 일치하지 않습니다." }, { status: 404 });
    }
  }

  const slots = [
    resolveSlot(row.team_a_player1_member_row, row.team_a_player1_guest_row),
    resolveSlot(row.team_a_player2_member_row, row.team_a_player2_guest_row),
    resolveSlot(row.team_b_player1_member_row, row.team_b_player1_guest_row),
    resolveSlot(row.team_b_player2_member_row, row.team_b_player2_guest_row),
  ];

  // relation embed 결과만 믿지 않고, 참가자 각각이 실제로 이 클럽 소속인지 재검증한다.
  const memberIds = slots.filter((s) => !s.isGuest && s.id).map((s) => s.id);
  const guestIds = slots.filter((s) => s.isGuest && s.id).map((s) => s.id);

  if (memberIds.length > 0) {
    const { data: memberRows, error } = await admin
      .from("members")
      .select("id")
      .in("id", memberIds)
      .eq("club_id", currentClubId);
    if (error) {
      console.error("[matches/edit-detail]", error.code, error.message);
      return NextResponse.json({ error: "회원 조회 실패" }, { status: 500 });
    }
    if ((memberRows ?? []).length !== new Set(memberIds).size) {
      return NextResponse.json({ error: "참가자 정보가 일치하지 않습니다." }, { status: 404 });
    }
  }

  if (guestIds.length > 0) {
    const { data: guestRows, error } = await admin
      .from("guests")
      .select("id")
      .in("id", guestIds)
      .eq("club_id", currentClubId);
    if (error) {
      console.error("[matches/edit-detail]", error.code, error.message);
      return NextResponse.json({ error: "게스트 조회 실패" }, { status: 500 });
    }
    if ((guestRows ?? []).length !== new Set(guestIds).size) {
      return NextResponse.json({ error: "참가자 정보가 일치하지 않습니다." }, { status: 404 });
    }
  }

  return NextResponse.json(
    {
      match: {
        id: row.id,
        playedAt: row.played_at,
        scoreA: row.score_a,
        scoreB: row.score_b,
        scoreATiebreak: row.score_a_tiebreak,
        scoreBTiebreak: row.score_b_tiebreak,
        winnerTeam: row.winner_team,
        sessionId: row.session_id,
        teamAPlayer1: slots[0],
        teamAPlayer2: slots[1],
        teamBPlayer1: slots[2],
        teamBPlayer2: slots[3],
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
