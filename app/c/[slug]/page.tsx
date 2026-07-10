import Link from "next/link";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { MATCH_SESSION_DAY_LABEL, selectHomeSessions } from "@/lib/match-session-label";
import { HomeAttendanceSection } from "@/components/attendance/HomeAttendanceSection";
import { RankingTeaserCard } from "@/components/ranking/RankingTeaserCard";
import { SectionHeader, EmptyState } from "@/components/ui/SectionHeader";
import { applyRankingQuery } from "@/lib/ranking-query";
import { isAdminSession } from "@/lib/admin-auth";
import { getClubSkin } from "@/lib/club-skin";
import { ClubBrandHeader, PublicShell } from "@/components/shell";
import type { AttendanceSession, MemberWithStats } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const MAIN_SESSION_LIMIT = 5;

function thisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
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

export default async function ClubHomePage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);
  const clubId = club.id;

  const supabase = createClient();
  const week = thisWeekRange();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: activeSessionRows },
    { data: recentMatchRows },
    { data: weeklyGuests },
    { data: topRankRows },
  ] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("club_id", clubId)
      .in("status", ["open", "closed"])
      .gte("session_date", today),

    supabase
      .from("matches")
      .select(MATCH_SELECT_WITH_PLAYERS)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(3),

    supabase
      .from("guests")
      .select("*")
      .eq("club_id", clubId)
      .gte("visit_date", week.start)
      .lte("visit_date", week.end)
      .order("visit_date", { ascending: true }),

    applyRankingQuery(supabase, clubId, 3),
  ]);

  const allSessions = selectHomeSessions((activeSessionRows ?? []) as AttendanceSession[]);
  const sessions = allSessions.slice(0, MAIN_SESSION_LIMIT);
  const hasMoreSessions = allSessions.length > MAIN_SESSION_LIMIT;

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
  const topRanked = (topRankRows ?? []) as MemberWithStats[];
  const isAdmin = isAdminSession();
  const skin = getClubSkin(club.skin_key);

  return (
    <PublicShell>
      <ClubBrandHeader
        club={club}
        skin={skin}
        subtitle="복식 테니스 리그 · 정기 매치 · 기록 관리"
      />

      <HomeAttendanceSection currentClubId={clubId} />

      <section className="mb-4">
        <SectionHeader
          title="다음 일정"
          href={hasMoreSessions ? `/c/${slug}/attendance` : undefined}
          cta={hasMoreSessions ? "더보기" : undefined}
        />
        {sessions.length === 0 ? (
          <EmptyState message="현재 진행 중인 출석 세션이 없어요." />
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const summary = summaryBySession.get(session.id)!;
              const typeLabel = MATCH_SESSION_DAY_LABEL[session.session_day];
              const [, m, d] = session.session_date.split("-");
              const dateLabel = `${Number(m)}/${Number(d)}`;
              return (
                <Link key={session.id} href={`/c/${slug}/attendance?session_id=${session.id}`}>
                  <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 transition-colors hover:border-clay-400/30">
                    <div className="absolute left-0 top-0 h-full w-1 bg-clay-400/50" />
                    <div className="px-4 py-3 pl-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-line-900">{session.title}</p>
                          <p className="mt-0.5 text-xs text-line-500">
                            {typeLabel} · {dateLabel}
                          </p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] text-line-500">
                        출석 {summary.attending} · 미정 {summary.undecided} · 불참 {summary.absent}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {topRanked.length > 0 && (
        <section className="mb-4">
          <SectionHeader title="현재 순위" href={`/c/${slug}/ranking`} cta="전체 랭킹" />
          <RankingTeaserCard members={topRanked} rankingHref={`/c/${slug}/ranking`} />
        </section>
      )}

      <section className="mb-4">
        <SectionHeader title="최근 경기" href={`/c/${slug}/matches`} cta="전체보기" />
        {recentMatches.length === 0 ? (
          <EmptyState message="아직 등록된 경기가 없어요." />
        ) : (
          <div className="space-y-2">
            {recentMatches.map((match) => (
              <MatchCard key={match.id} match={match} currentClubId={clubId} />
            ))}
          </div>
        )}
      </section>

      {isAdmin && guestsThisWeek.length > 0 && (
        <section>
          <SectionHeader title="이번 주 게스트" href="/guests" cta="전체보기" />
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {guestsThisWeek.map((guest, idx) => (
              <div
                key={guest.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx < guestsThisWeek.length - 1 ? "border-b border-line-200/30" : ""
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-line-900">{guest.name}</span>
                  {guest.skill_grade && <Badge tone="amber">{guest.skill_grade}급</Badge>}
                </div>
                <span className="text-xs text-line-500">{guest.visit_date}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
