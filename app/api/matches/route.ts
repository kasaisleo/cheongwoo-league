import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { calculateDoublesElo } from "@/lib/elo";
import type { Member } from "@/lib/supabase/database.types";

interface CreateMatchBody {
  playedAt: string;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  scoreA: number;
  scoreB: number;
  winnerTeam: "A" | "B";
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
    winnerTeam,
  } = body;

  const playerIds = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
  if (new Set(playerIds).size !== 4) {
    return NextResponse.json({ error: "4명의 선수가 모두 달라야 합니다." }, { status: 400 });
  }
  if (
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0 ||
    (winnerTeam !== "A" && winnerTeam !== "B")
  ) {
    return NextResponse.json({ error: "점수와 승리팀 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. 현재 4명의 레이팅 조회
  const { data: members, error: fetchError } = await supabase
    .from("members")
    .select("*")
    .in("id", playerIds);

  if (fetchError || !members || members.length !== 4) {
    return NextResponse.json({ error: "선수 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const memberById = new Map<string, Member>(members.map((m: Member) => [m.id, m]));
  const a1 = memberById.get(teamAPlayer1)!;
  const a2 = memberById.get(teamAPlayer2)!;
  const b1 = memberById.get(teamBPlayer1)!;
  const b2 = memberById.get(teamBPlayer2)!;

  // 2. ELO 계산
  const elo = calculateDoublesElo({
    teamARating1: a1.rating,
    teamARating2: a2.rating,
    teamBRating1: b1.rating,
    teamBRating2: b2.rating,
    winner: winnerTeam,
  });

  // 3. 경기 저장
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      played_at: playedAt,
      team_a_player1: teamAPlayer1,
      team_a_player2: teamAPlayer2,
      team_b_player1: teamBPlayer1,
      team_b_player2: teamBPlayer2,
      score_a: scoreA,
      score_b: scoreB,
      winner_team: winnerTeam,
    })
    .select()
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "경기 결과 저장에 실패했습니다." }, { status: 500 });
  }

  // 4. 선수별 레이팅/승패 갱신 + 레이팅 히스토리 기록
  const updates = [
    { member: a1, newRating: elo.teamANewRating1, won: winnerTeam === "A" },
    { member: a2, newRating: elo.teamANewRating2, won: winnerTeam === "A" },
    { member: b1, newRating: elo.teamBNewRating1, won: winnerTeam === "B" },
    { member: b2, newRating: elo.teamBNewRating2, won: winnerTeam === "B" },
  ];

  for (const { member, newRating, won } of updates) {
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
