import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { calculateDoublesElo } from "@/lib/elo";
import type { Member, Guest } from "@/lib/supabase/database.types";

/** 게스트가 경기에 참여할 때 ELO 계산에만 쓰는 임시 레이팅(C급 기준). 게스트 본인에게는 저장되지 않는다. */
const GUEST_TEMP_RATING = 1300;

interface PlayerInput {
  id: string;
  isGuest: boolean;
}

interface CreateMatchBody {
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
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as CreateMatchBody;
  const {
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

  // 1. 회원/게스트 선수 정보 조회
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

  const memberById = new Map<string, Member>(memberRows.map((m: Member) => [m.id, m]));
  const guestById = new Map<string, Guest>(guestRows.map((g: Guest) => [g.id, g]));

  function ratingOf(p: PlayerInput): number {
    return p.isGuest ? GUEST_TEMP_RATING : memberById.get(p.id)!.rating;
  }

  // 2. ELO 계산 (게스트는 임시 레이팅으로 계산에만 참여, 결과는 게스트 본인에게 반영하지 않음)
  const elo = calculateDoublesElo({
    teamARating1: ratingOf(teamAPlayer1),
    teamARating2: ratingOf(teamAPlayer2),
    teamBRating1: ratingOf(teamBPlayer1),
    teamBRating2: ratingOf(teamBPlayer2),
    winner: winnerTeam,
  });

  // 3. 경기 저장 (각 슬롯은 member/guest 중 하나만 채움)
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
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
    .select()
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "경기 결과 저장에 실패했습니다." }, { status: 500 });
  }

  // 4. 선수별 갱신
  //    - 회원: 레이팅 갱신 + 승/패 갱신 + rating_history 기록
  //    - 게스트: 승/패만 갱신 (레이팅 없음, rating_history 없음)
  const updates = [
    { player: teamAPlayer1, newRating: elo.teamANewRating1, won: winnerTeam === "A" },
    { player: teamAPlayer2, newRating: elo.teamANewRating2, won: winnerTeam === "A" },
    { player: teamBPlayer1, newRating: elo.teamBNewRating1, won: winnerTeam === "B" },
    { player: teamBPlayer2, newRating: elo.teamBNewRating2, won: winnerTeam === "B" },
  ];

  for (const { player, newRating, won } of updates) {
    if (player.isGuest) {
      const guest = guestById.get(player.id)!;
      await supabase
        .from("guests")
        .update({
          wins: guest.wins + (won ? 1 : 0),
          losses: guest.losses + (won ? 0 : 1),
        })
        .eq("id", guest.id);
      continue;
    }

    const member = memberById.get(player.id)!;
    await supabase
      .from("members")
      .update({
        rating: newRating,
        wins: member.wins + (won ? 1 : 0),
        losses: member.losses + (won ? 0 : 1),
      })
      .eq("id", member.id);

    await supabase.from("rating_history").insert({
      match_id: match.id,
      member_id: member.id,
      rating_before: member.rating,
      rating_after: newRating,
      rating_change: newRating - member.rating,
    });
  }

  return NextResponse.json({ ok: true, matchId: match.id });
}
