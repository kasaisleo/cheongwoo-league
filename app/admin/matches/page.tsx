import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SessionMatchCard, type SessionGroup } from "./SessionMatchCard";
import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * /admin/matches — 매치별 경기 히스토리 관리 허브.
 */

const SESSION_FILTERS = [
  { key: "all",      label: "전체" },
  { key: "saturday", label: "토요 정기" },
  { key: "sunday",   label: "일요 정기" },
  { key: "holiday",  label: "휴일" },
  { key: "custom",   label: "이벤트" },
] as const;

const VALID_SESSION_TYPES: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];

interface PageProps {
  searchParams: { sessionType?: string; q?: string };
}

export default async function AdminMatchesPage({ searchParams }: PageProps) {
  const access = await getAdminAccessServer();
  const supabase = createClient();
  const currentClubId = access.clubId ?? "";

  const rawType = searchParams.sessionType ?? "all";
  const sessionType = VALID_SESSION_TYPES.includes(rawType as SessionDay)
    ? (rawType as SessionDay) : null;
  const q = searchParams.q?.trim() ?? "";

  // ── 세션(매치) 목록 ────────────────────────────────────────────
  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("id, title, session_date, session_day, status")
    .eq("club_id", currentClubId)
    .neq("status", "archived")
    .order("session_date", { ascending: false })
    .limit(40);

  if (sessionType) sessionQuery = sessionQuery.eq("session_day", sessionType);

  const { data: sessions } = await sessionQuery;
  const sessionList = sessions ?? [];

  const filteredSessions = q
    ? sessionList.filter((s) =>
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.session_date.includes(q)
      )
    : sessionList;

  const sessionIds = filteredSessions.map((s) => s.id);

  const { data: rawMatches } = sessionIds.length > 0
    ? await supabase
        .from("matches")
        .select(MATCH_SELECT_WITH_PLAYERS)
        .in("session_id", sessionIds)
        .order("played_at", { ascending: true })
    : { data: [] };

  let matchList = toDisplayMatches(rawMatches ?? []);
  if (q) {
    const playerMatch = matchList.filter((m) =>
      [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].some((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      )
    );
    const extraSessionIds = new Set(playerMatch.map((m) => m.session_id).filter(Boolean));
    const extraSessions = (sessions ?? []).filter(
      (s) => extraSessionIds.has(s.id) && !filteredSessions.find((f) => f.id === s.id)
    );
    filteredSessions.push(...extraSessions);
    filteredSessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
  }

  const matchesBySession = new Map<string, typeof matchList>();
  for (const m of matchList) {
    if (!m.session_id) continue;
    if (!matchesBySession.has(m.session_id)) matchesBySession.set(m.session_id, []);
    matchesBySession.get(m.session_id)!.push(m);
  }

  const allIds = filteredSessions.map((s) => s.id);
  const { data: attendRows } = allIds.length > 0
    ? await supabase
        .from("attendance")
        .select("session_id, status")
        .in("session_id", allIds)
    : { data: [] };

  const { count: totalMembers } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("club_id", currentClubId);

  const attendBySession = new Map<string, { attending: number; undecided: number; absent: number }>();
  for (const row of attendRows ?? []) {
    if (!row.session_id) continue;
    const cur = attendBySession.get(row.session_id) ?? { attending: 0, undecided: 0, absent: 0 };
    if (row.status === "attending") cur.attending++;
    else if (row.status === "undecided") cur.undecided++;
    else if (row.status === "absent") cur.absent++;
    attendBySession.set(row.session_id, cur);
  }

  const groups: SessionGroup[] = filteredSessions.map((s) => {
    const attend = attendBySession.get(s.id) ?? { attending: 0, undecided: 0, absent: 0 };
    const responded = attend.attending + attend.undecided + attend.absent;
    const noResponse = Math.max(0, (totalMembers ?? 0) - responded);
    return {
      sessionId: s.id,
      sessionDate: s.session_date,
      sessionDay: s.session_day,
      sessionTitle: s.title,
      sessionStatus: s.status,
      attendingCount: attend.attending,
      undecidedCount: attend.undecided,
      absentCount: attend.absent,
      noResponseCount: noResponse,
      matches: matchesBySession.get(s.id) ?? [],
      canEdit: access.isAdmin,
      canDelete: access.isOwner,
    };
  });

  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(searchParams as Record<string, string>).filter(([, v]) => v)
    )
  );

  return (
    <main className="px-4 pt-6 pb-28">

      <AdminPageHeader
        eyebrow="MATCHES"
        title="경기 관리"
        description="매치별 경기 히스토리와 결과를 관리합니다."
      />

      {/* ── 매치 생성 버튼 */}
      <div className="mb-5">
        <Link href="/admin/matches/create"
          className="inline-flex items-center rounded-[var(--admin-button-radius,6px)] border border-clay-400/60 bg-clay-400/10 px-3 py-2 text-sm font-semibold text-clay-400 hover:bg-clay-400/20">
          + 매치 생성
        </Link>
      </div>

      {/* ── 매치 유형 필터 */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {SESSION_FILTERS.map((f) => {
            const isActive = (f.key === "all" && !sessionType) || f.key === sessionType;
            const fp = new URLSearchParams(params);
            if (f.key === "all") fp.delete("sessionType"); else fp.set("sessionType", f.key);
            if (q) fp.set("q", q); else fp.delete("q");
            return (
              <Link key={f.key} href={`/admin/matches?${fp.toString()}`}>
                <span
                  className="rounded-[var(--admin-button-radius,6px)] border px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={
                    isActive
                      ? { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }
                      : { borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-muted)" }
                  }
                >
                  {f.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 검색 */}
      <section className="mb-5">
        <form method="GET" action="/admin/matches">
          {sessionType && <input type="hidden" name="sessionType" value={sessionType} />}
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="매치명 · 날짜 · 선수명 검색"
              className="h-9 flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 text-sm placeholder:[color:var(--admin-muted)]"
              style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
            />
            <button
              type="submit"
              className="rounded-[var(--admin-button-radius,6px)] border px-3 text-xs font-semibold"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
            >
              검색
            </button>
            {q && (
              <Link
                href={`/admin/matches${sessionType ? `?sessionType=${sessionType}` : ""}`}
                className="flex items-center rounded-[var(--admin-button-radius,6px)] border px-3 text-xs font-semibold"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
              >
                초기화
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* ── 매치 카드 목록 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            매치 목록
            <span className="ml-1.5" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>({groups.length})</span>
          </p>
        </div>

        {groups.length === 0 ? (
          <div
            className="rounded-[var(--admin-card-radius,14px)] border p-8 text-center"
            style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}
          >
            <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
              매치 없음
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
              {q ? `"${q}" 검색 결과가 없어요.` : "등록된 매치가 없어요."}
            </p>
            <Link
              href="/admin/matches/create"
              className="mt-3 inline-block rounded-[var(--admin-button-radius,6px)] border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400"
            >
              매치 생성 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <SessionMatchCard key={group.sessionId} group={group} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
