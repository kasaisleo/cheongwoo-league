import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";

const MIN_REQUIRED_PLAYERS = 4;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 오늘 기준 이번 주(월~일) 시작/끝 날짜 문자열 */
function thisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0(일)~6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export default async function HomePage() {
  const supabase = createClient();
  const today = todayString();
  const week = thisWeekRange();

  const [{ data: attendanceRows }, { data: recentMatchRows }, { data: weeklyGuests }] =
    await Promise.all([
      supabase.from("attendance").select("status, members(name, nickname)").eq("event_date", today),
      supabase
        .from("matches")
        .select(MATCH_SELECT_WITH_PLAYERS)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("guests")
        .select("*")
        .gte("visit_date", week.start)
        .lte("visit_date", week.end)
        .order("visit_date", { ascending: true }),
    ]);

  const attending = attendanceRows?.filter((a) => a.status === "attending").length ?? 0;
  const undecided = attendanceRows?.filter((a) => a.status === "undecided").length ?? 0;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);
  const recentMatches = toDisplayMatches(recentMatchRows);
  const guestsThisWeek = weeklyGuests ?? [];

  return (
    <main className="px-4 pt-6">
      <header className="mb-6">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Mapo Cheongwoo Club
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          마포 청우회 리그
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

      {guestsThisWeek.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">이번 주 게스트</h2>
            <Link href="/guests" className="text-xs font-semibold text-clay-400">
              전체보기
            </Link>
          </div>
          <div className="space-y-2">
            {guestsThisWeek.map((guest) => (
              <Card key={guest.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-line-900">{guest.name}</span>
                  {guest.skill_grade && <Badge tone="amber">{guest.skill_grade}급</Badge>}
                </div>
                <span className="text-xs text-line-400">{guest.visit_date}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">최근 경기</h2>
          <Link href="/matches" className="text-xs font-semibold text-clay-400">
            전체보기
          </Link>
        </div>

        {recentMatches.length === 0 ? (
          <Card className="p-6 text-center text-sm text-line-400">
            아직 등록된 경기가 없어요. 경기입력 탭에서 첫 경기를 기록해보세요.
          </Card>
        ) : (
          <div className="space-y-2">
            {recentMatches.map((match) => (
              <Card key={match.id} className="p-3">
                <div className="flex items-center justify-between text-xs text-line-400">
                  <span>{match.played_at}</span>
                  <Badge tone={match.winner_team === "A" ? "clay" : "court"}>
                    {match.winner_team === "A" ? "청팀 승" : "우팀 승"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className={match.winner_team === "A" ? "font-semibold text-line-900" : "text-line-500"}>
                    {match.teamAPlayer1.nickname} · {match.teamAPlayer2.nickname}
                  </span>
                  <span className="font-score font-bold text-line-900">
                    {match.score_a} : {match.score_b}
                    {match.score_a_tiebreak !== null && (
                      <span className="ml-1 text-xs font-normal text-line-500">
                        ({match.score_a_tiebreak}-{match.score_b_tiebreak})
                      </span>
                    )}
                  </span>
                  <span className={match.winner_team === "B" ? "font-semibold text-line-900" : "text-line-500"}>
                    {match.teamBPlayer1.nickname} · {match.teamBPlayer2.nickname}
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
