import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapMatchRpcError } from "@/lib/match-engine";
import type { Member, Guest } from "@/lib/supabase/database.types";

interface PlayerInput {
  id: string;
  isGuest: boolean;
}

interface CreateMatchBody {
  sessionId: string;
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

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  if (!access.clubId) return Response.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });

  const body = (await request.json()) as CreateMatchBody;
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

  if (!sessionId) {
    return NextResponse.json({ error: "출석 세션을 선택해주세요." }, { status: 400 });
  }

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

  // 1. 회원/게스트 선수 정보 존재+club 소속 확인. create_match_with_effects(0045) 내부에도
  //    동일 검증(PARTICIPANT_CLUB_MISMATCH)이 있지만 member/guest를 구분하지 않는 단일
  //    메시지라, 기존 UX(회원/게스트 각각 다른 메시지)를 유지하기 위해 여기서 먼저 확인한다.
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

  // 2. 중복 저장 방지는 이번 단계에서 보류한다.
  //    - 같은 날 같은 4명이 같은 스코어로 여러 세트를 치는 경우가 실제로 있어,
  //      "4명+날짜+스코어 일치"만으로 서버에서 무조건 거부하지 않는다.
  //    - idempotency_key(클라이언트 요청 식별자) 기반 차단이 더 안전하지만,
  //      matches.idempotency_key 컬럼 추가는 후순위 작업이라 아직 도입하지 않는다.
  //    - 현재는 프론트엔드의 저장 버튼 중복 클릭 방지(disabled 처리)로만 방어한다.

  // 3. create_match_with_effects(0045) 호출 — matches insert + 선수별 LP/wins/losses/
  //    point_history 반영을 단일 DB 트랜잭션으로 처리한다. 세션 존재/archived 검증은
  //    RPC 내부에서 동일한 메시지로 재현되므로 별도 pre-check를 두지 않는다.
  const { data: newMatchId, error: rpcError } = await supabase.rpc("create_match_with_effects", {
    p_club_id: currentClubId,
    p_session_id: sessionId,
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

  if (rpcError || !newMatchId) {
    const { status, message } = mapMatchRpcError(rpcError?.message, "경기 결과 저장에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, matchId: newMatchId });
}
