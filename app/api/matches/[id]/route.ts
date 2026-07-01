import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { applyMatch, rollbackMatch } from "@/lib/match-engine";
import type { Match, Member, Guest } from "@/lib/supabase/database.types";

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
 * 처리 순서: rollbackMatch(기존 경기 효과 되돌리기) → 경기 내용 수정 → applyMatch(새 효과 적용)
 * 이 순서를 지켜야 LP/wins/losses가 항상 "현재 저장된 경기 내용"과 일치하는 상태를 유지한다.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

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

  // 0. 기존 경기 조회
  const { data: existingMatch, error: fetchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (fetchError || !existingMatch) {
    return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });
  }

  // 1. 새로 선택된 선수들이 실제로 존재하는지 확인
  const memberIds = players.filter((p) => !p.isGuest).map((p) => p.id);
  const guestIds = players.filter((p) => p.isGuest).map((p) => p.id);

  let memberRows: Member[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from("members").select("*").in("id", memberIds);
    memberRows = data ?? [];
  }

  let guestRows: Guest[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase.from("guests").select("*").in("id", guestIds);
    guestRows = data ?? [];
  }

  if (memberRows.length !== memberIds.length) {
    return NextResponse.json({ error: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }
  if (guestRows.length !== guestIds.length) {
    return NextResponse.json({ error: "게스트 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  // 1-1. session_id가 함께 전달된 경우, 그 세션이 유효한지(존재 + archived 아님) 확인한다.
  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    if (session.status === "archived") {
      return NextResponse.json(
        { error: "보관된 세션으로는 변경할 수 없습니다." },
        { status: 400 }
      );
    }
  }

  // 2. rollback — 기존 경기가 미쳤던 효과(LP/wins/losses)를 먼저 되돌린다.
  const rollbackResult = await rollbackMatch(supabase, existingMatch as Match);
  if (!rollbackResult.ok) {
    return NextResponse.json({ error: rollbackResult.error }, { status: 500 });
  }

  // 3. 경기 내용 수정
  const { data: updatedMatch, error: updateError } = await supabase
    .from("matches")
    .update({
      session_id: sessionId ?? (existingMatch as Match).session_id,
      played_at: playedAt,
      team_a_player1_member: teamAPlayer1.isGuest ? null : teamAPlayer1.id,
      team_a_player1_guest: teamAPlayer1.isGuest ? teamAPlayer1.id : null,
      team_a_player2_member: teamAPlayer2.isGuest ? null : teamAPlayer2.id,
      team_a_player2_guest: teamAPlayer2.isGuest ? teamAPlayer2.id : null,
      team_b_player1_member: teamBPlayer1.isGuest ? null : teamBPlayer1.id,
      team_b_player1_guest: teamBPlayer1.isGuest ? teamBPlayer1.id : null,
      team_b_player2_member: teamBPlayer2.isGuest ? null : teamBPlayer2.id,
      team_b_player2_guest: teamBPlayer2.isGuest ? teamBPlayer2.id : null,
      score_a: scoreA,
      score_b: scoreB,
      score_a_tiebreak: isTiebreakSet ? scoreATiebreak : null,
      score_b_tiebreak: isTiebreakSet ? scoreBTiebreak : null,
      winner_team: winnerTeam,
    })
    .eq("id", matchId)
    .select()
    .single();

  if (updateError || !updatedMatch) {
    // 수정 자체가 실패하면, 방금 되돌린 효과를 원래 경기 내용으로 다시 적용해 정합성을 복구한다.
    await applyMatch(supabase, existingMatch as Match);
    return NextResponse.json({ error: "경기 수정에 실패했습니다." }, { status: 500 });
  }

  // 4. apply — 수정된 새 경기 내용으로 효과를 다시 적용한다.
  const applyResult = await applyMatch(supabase, updatedMatch as Match);
  if (!applyResult.ok) {
    return NextResponse.json({ error: applyResult.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId: updatedMatch.id });
}

/**
 * 경기 삭제. manager 이상만 가능 (현재는 isAdminSession으로 대체).
 *
 * 처리 순서: rollbackMatch(효과 되돌리기) → 경기 행 삭제.
 * point_history.match_id는 on delete set null로 설정되어 있어, 경기가 삭제되어도
 * rollback이 남긴 보정 레코드(및 기존 이력)는 그대로 보존된다(match_id만 null이 됨).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.isOwner) return Response.json({ error: "경기 삭제는 master/owner만 가능합니다." }, { status: 403 });

  const matchId = params.id;
  const supabase = createServiceClient();

  const { data: existingMatch, error: fetchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (fetchError || !existingMatch) {
    return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });
  }

  const rollbackResult = await rollbackMatch(supabase, existingMatch as Match);
  if (!rollbackResult.ok) {
    return NextResponse.json({ error: rollbackResult.error }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("matches").delete().eq("id", matchId);

  if (deleteError) {
    // 삭제 자체가 실패하면, 되돌렸던 효과를 다시 적용해 정합성을 복구한다.
    await applyMatch(supabase, existingMatch as Match);
    return NextResponse.json({ error: "경기 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
