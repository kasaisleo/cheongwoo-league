import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapMatchRpcError } from "@/lib/match-engine";
import type { Member, Guest } from "@/lib/supabase/database.types";

interface PlayerInput {
  id: string;
  isGuest: boolean;
}

interface UpdateMatchBody {
  sessionId?: string;
  playedAt: string;
  teamAPlayer1: PlayerInput;
  teamAPlayer2: PlayerInput;
  teamBPlayer1: PlayerInput;
  teamBPlayer2: PlayerInput;
  scoreA: number;
  scoreB: number;
  scoreATiebreak: number | null;
  scoreBTiebreak: number | null;
  winnerTeam: "A" | "B";
}

function isValidPlayer(p: unknown): p is PlayerInput {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as PlayerInput).id === "string" &&
    typeof (p as PlayerInput).isGuest === "boolean"
  );
}

interface RouteParams {
  params: { id: string };
}

/**
 * 경기 수정. manager 이상만 가능 (현재는 isAdminSession으로 대체, 권한 시스템
 * 도입 후 permission_role >= manager 체크로 교체할 것).
 *
 * update_match_with_effects(0045)가 기존 경기 lock + 효과 undo + 내용 수정 +
 * 신규 효과 apply를 단일 DB 트랜잭션으로 처리한다 — route는 더 이상 이
 * 순서를 조립하지 않는다.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  if (!access.clubId) return Response.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });

  const matchId = params.id;
  const body = (await request.json()) as UpdateMatchBody;
  const {
    sessionId,
    playedAt,
    teamAPlayer1,
    teamAPlayer2,
    teamBPlayer1,
    teamBPlayer2,
    scoreA,
    scoreB,
    scoreATiebreak,
    scoreBTiebreak,
    winnerTeam,
  } = body;

  const players = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
  if (!players.every(isValidPlayer)) {
    return NextResponse.json({ error: "선수 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const playerKeys = players.map((p) => `${p.isGuest ? "guest" : "member"}:${p.id}`);
  if (new Set(playerKeys).size !== 4) {
    return NextResponse.json({ error: "4명의 선수가 모두 달라야 합니다." }, { status: 400 });
  }

  const isValidSetScore = (s: number) => Number.isInteger(s) && s >= 0 && s <= 7;
  if (
    !isValidSetScore(scoreA) ||
    !isValidSetScore(scoreB) ||
    (winnerTeam !== "A" && winnerTeam !== "B")
  ) {
    return NextResponse.json({ error: "점수와 승리팀 정보가 올바르지 않습니다." }, { status: 400 });
  }

  // 2A-8D-3A: legacy 경기 기록은 동점을 저장할 수 없다(생성 경로와 동일 계약).
  // Event Game의 5:5 무승부는 전용 Event result API만 다룬다. RPC의
  // LEGACY_MATCH_TIE_NOT_ALLOWED가 최종 방어선이고 여기가 주 경로다.
  if (scoreA === scoreB) {
    return NextResponse.json(
      { error: "기존 경기 기록에서는 동점 결과를 저장할 수 없습니다." },
      { status: 400 }
    );
  }

  const isTiebreakSet = (scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7);
  if (isTiebreakSet) {
    const validTiebreak = (s: number | null) => s !== null && Number.isInteger(s) && s >= 0;
    if (!validTiebreak(scoreATiebreak) || !validTiebreak(scoreBTiebreak)) {
      return NextResponse.json(
        { error: "7-6 스코어에는 타이브레이크 점수를 입력해주세요." },
        { status: 400 }
      );
    }
  }

  const supabase = createServiceClient();
  const currentClubId = access.clubId;

  // 1. 새로 선택된 선수들이 실제로 존재하는지 확인. update_match_with_effects(0045)
  //    내부에도 동일 검증이 있지만 member/guest를 구분하지 않으므로, 기존 UX(회원/게스트
  //    각각 다른 메시지)를 유지하기 위해 여기서 먼저 확인한다.
  const memberIds = players.filter((p) => !p.isGuest).map((p) => p.id);
  const guestIds = players.filter((p) => p.isGuest).map((p) => p.id);

  let memberRows: Pick<Member, "id">[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("members")
      .select("id")
      .in("id", memberIds)
      .eq("club_id", currentClubId);
    memberRows = data ?? [];
  }

  let guestRows: Pick<Guest, "id">[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase
      .from("guests")
      .select("id")
      .in("id", guestIds)
      .eq("club_id", currentClubId);
    guestRows = data ?? [];
  }

  if (memberRows.length !== memberIds.length) {
    return NextResponse.json({ error: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }
  if (guestRows.length !== guestIds.length) {
    return NextResponse.json({ error: "게스트 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  // 2. update_match_with_effects(0045) 호출 — 매치 존재 확인(lock), 세션 검증,
  //    기존 효과 undo, 내용 수정, 신규 효과 apply를 단일 트랜잭션으로 처리한다.
  //    sessionId를 보내지 않으면 null을 전달하고, RPC가 기존 session_id를 그대로
  //    유지한다(기존 route의 `sessionId ?? existingMatch.session_id`와 동일 의미).
  const { error: rpcError } = await supabase.rpc("update_match_with_effects", {
    p_match_id: matchId,
    p_club_id: currentClubId,
    p_session_id: sessionId ?? null,
    p_played_at: playedAt,
    p_score_a: scoreA,
    p_score_b: scoreB,
    p_score_a_tiebreak: isTiebreakSet ? scoreATiebreak : null,
    p_score_b_tiebreak: isTiebreakSet ? scoreBTiebreak : null,
    p_winner_team: winnerTeam,
    p_team_a_player1_member: teamAPlayer1.isGuest ? null : teamAPlayer1.id,
    p_team_a_player1_guest: teamAPlayer1.isGuest ? teamAPlayer1.id : null,
    p_team_a_player2_member: teamAPlayer2.isGuest ? null : teamAPlayer2.id,
    p_team_a_player2_guest: teamAPlayer2.isGuest ? teamAPlayer2.id : null,
    p_team_b_player1_member: teamBPlayer1.isGuest ? null : teamBPlayer1.id,
    p_team_b_player1_guest: teamBPlayer1.isGuest ? teamBPlayer1.id : null,
    p_team_b_player2_member: teamBPlayer2.isGuest ? null : teamBPlayer2.id,
    p_team_b_player2_guest: teamBPlayer2.isGuest ? teamBPlayer2.id : null,
  });

  if (rpcError) {
    const { status, message } = mapMatchRpcError(rpcError.message, "경기 수정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, matchId });
}

/**
 * 경기 삭제. manager 이상만 가능 (현재는 isAdminSession으로 대체).
 *
 * delete_match_with_effects(0045)가 매치 존재 확인(lock) + 효과 undo + 행
 * 삭제를 단일 트랜잭션으로 처리한다. point_history.match_id는 on delete set
 * null이므로, 경기가 삭제되어도 rollback이 남긴 보정 레코드(및 기존 이력)는
 * 그대로 보존된다(match_id만 null이 됨) — RPC 내부에서도 동일하게 일어난다.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) return Response.json({ error: "경기 삭제는 master/owner만 가능합니다." }, { status: 403 });
  if (!access.clubId) return Response.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });

  const matchId = params.id;
  const supabase = createServiceClient();
  const currentClubId = access.clubId;

  const { error: rpcError } = await supabase.rpc("delete_match_with_effects", {
    p_match_id: matchId,
    p_club_id: currentClubId,
  });

  if (rpcError) {
    const { status, message } = mapMatchRpcError(rpcError.message, "경기 삭제에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
