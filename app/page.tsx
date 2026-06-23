import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { MatchWithPlayers } from "@/lib/supabase/database.types";

const MIN_REQUIRED_PLAYERS = 4;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HomePage() {
  const supabase = createClient();
  const today = todayString();

  const [{ data: attendanceRows }, { data: recentMatches }] = await Promise.all([
    supabase
      .from("attendance")
      .select("status, members(name, nickname)")
      .eq("event_date", today),
    supabase
      .from("matches")
      .select(
        `id, played_at, score_a, score_b, winner_team,
         team_a_player1_member:members!matches_team_a_player1_fkey(name, nickname),
         team_a_player2_member:members!matches_team_a_player2_fkey(name, nickname),
         team_b_player1_member:members!matches_team_b_player1_fkey(name, nickname),
         team_b_player2_member:members!matches_team_b_player2_fkey(name, nickname)`
      )
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const attending = attendanceRows?.filter((a) => a.status === "attending").length ?? 0;
  const undecided = attendanceRows?.filter((a) => a.status === "undecided").length ?? 0;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);

  return (
    <main className="px-4 pt-6">
      <header className="mb-6">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Cheongwoo League
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          청우리그
        </h1>
      </header>

      <Link href={`/attendance`}>
        <Card className="mb-4 border-l-4 border-l-clay-400 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-line-600">오늘 출석</p>
              <p className="font-score text-4xl font-bold leading-none text-line-900">
                {attending}
                <span className="text-base font-normal text-line-500"> 명 참석</span>
              </p>
            </div>
            {shortage > 0 ? (
              <Badge tone="fault">{shortage}명 부족</Badge>
            ) : (
              <Badge tone="court">복식 가능</Badge>
            )}
          </div>
          {undecided > 0 && (
            <p className="mt-2 text-xs text-amber-400">미정 {undecided}명 — 출석 체크를 독려해보세요</p>
          )}
        </Card>
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">최근 경기</h2>
          <Link href="/matches" className="text-xs font-semibold text-clay-400">
            전체보기
          </Link>
        </div>

        {!recentMatches || recentMatches.length === 0 ? (
          <Card className="p-6 text-center text-sm text-line-400">
            아직 등록된 경기가 없어요. 경기입력 탭에서 첫 경기를 기록해보세요.
          </Card>
        ) : (
          <div className="space-y-2">
            {(recentMatches as unknown as MatchWithPlayers[]).map((match) => (
              <Card key={match.id} className="p-3">
                <div className="flex items-center justify-between text-xs text-line-400">
                  <span>{match.played_at}</span>
                  <Badge tone={match.winner_team === "A" ? "clay" : "court"}>
                    {match.winner_team === "A" ? "A팀 승" : "B팀 승"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className={match.winner_team === "A" ? "font-semibold text-line-900" : "text-line-500"}>
                    {match.team_a_player1_member.nickname} · {match.team_a_player2_member.nickname}
                  </span>
                  <span className="font-score font-bold text-line-900">
                    {match.score_a} : {match.score_b}
                  </span>
                  <span className={match.winner_team === "B" ? "font-semibold text-line-900" : "text-line-500"}>
                    {match.team_b_player1_member.nickname} · {match.team_b_player2_member.nickname}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
