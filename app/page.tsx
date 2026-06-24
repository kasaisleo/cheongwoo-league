import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { AttendanceSession } from "@/lib/supabase/database.types";

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
  const week = thisWeekRange();

  const [{ data: openSessions }, { data: recentMatchRows }, { data: weeklyGuests }] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select("*")
        .eq("status", "open")
        .order("session_date", { ascending: true }),
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

  const sessions = (openSessions ?? []) as AttendanceSession[];

  // 각 세션별 출석 현황을 한 번에 조회
  const sessionIds = sessions.map((s) => s.id);
  const { data: attendanceRows } =
    sessionIds.length > 0
      ? await supabase.from("attendance").select("session_id, status").in("session_id", sessionIds)
      : { data: [] };

  const summaryBySession = new Map<string, { attending: number; undecided: number; absent: number }>(
    sessions.map((session) => {
      const rows = (attendanceRows ?? []).filter((a) => a.session_id === session.id);
      return [
        session.id,
        {
          attending: rows.filter((r) => r.status === "attending").length,
          undecided: rows.filter((r) => r.status === "undecided").length,
          absent: rows.filter((r) => r.status === "absent").length,
        },
      ];
    })
  );

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

      <Link href="/attendance">
        <section className="mb-4 space-y-2">
          {sessions.length === 0 ? (
            <Card className="border-l-4 border-l-clay-400 p-4 text-sm text-line-400">
              현재 진행 중인 출석 세션이 없어요.
            </Card>
          ) : (
            sessions.map((session) => {
              const summary = summaryBySession.get(session.id)!;
              return (
                <Card key={session.id} className="border-l-4 border-l-clay-400 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-line-900">
                      {MATCH_SESSION_DAY_LABEL[session.session_day]}
                    </p>
                    <span className="text-xs text-line-400">{session.session_date}</span>
                  </div>
                  <p className="mt-1 text-xs text-line-500">
                    출석 {summary.attending} · 미정 {summary.undecided} · 불참 {summary.absent}
                  </p>
                </Card>
              );
            })
          )}
        </section>
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
