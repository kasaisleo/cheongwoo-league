import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * /admin/matches — 관리자 전용 경기 관리 페이지.
 *
 * 권한: requireAdminAccess() → layout.tsx에서 서버 사전 차단.
 *   허용: cw_admin_session owner/manager + kakao manager/admin/master
 *   차단: member, scorer, 비로그인
 *
 * 공개 /matches는 쇼룸으로 유지.
 * 경기 입력/수정 기능은 이 페이지에서 진입.
 */

const SESSION_FILTERS = [
  { key: "all",      label: "전체" },
  { key: "saturday", label: "토요일" },
  { key: "sunday",   label: "일요일" },
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

  // 필터 파라미터
  const rawType = searchParams.sessionType ?? "all";
  const sessionType = VALID_SESSION_TYPES.includes(rawType as SessionDay)
    ? (rawType as SessionDay) : null;
  const q = searchParams.q?.trim() ?? "";

  // 경기 목록 조회
  let query: any = supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .order("played_at", { ascending: false })
    .limit(50);

  if (sessionType) {
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("session_day", sessionType);
    const ids = (sessions ?? []).map((s) => s.id);
    if (ids.length > 0) query = query.in("session_id", ids);
    else query = query.is("session_id", null); // 해당 타입 세션 없음
  }

  const { data: rawMatches } = await query;
  let matches = toDisplayMatches(rawMatches ?? []);

  // 선수명 검색 (클라이언트 필터)
  if (q) {
    matches = matches.filter((m) =>
      [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].some((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      )
    );
  }

  return (
    <main className="px-4 pt-6 pb-28">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Matches</p>
          <h1 className="headline-kr text-4xl text-line-900">경기 관리</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-5 text-sm text-line-500">
        경기 결과를 입력, 확인, 수정하고 최근 경기 기록을 관리합니다.
      </p>

      {/* 빠른 작업 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Quick Actions
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/matches/new", label: "경기 입력", sub: "New Match", accent: "clay" },
            { href: "/matches",     label: "공개 경기", sub: "Public View", accent: "line" },
            { href: "/admin/share", label: "공유센터",  sub: "Share Links", accent: "gold" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-3 py-2.5 transition-colors hover:bg-line-100/40">
                <div className={`absolute left-0 top-0 h-full w-1 ${
                  item.accent === "clay" ? "bg-clay-400/50"
                  : item.accent === "gold" ? "bg-gold/50"
                  : "bg-line-300/40"
                }`} />
                <p className="text-sm font-semibold text-line-900">{item.label}</p>
                <p className="font-display text-[9px] font-bold uppercase tracking-wider text-line-500">
                  {item.sub}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 세션 타입 필터 */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {SESSION_FILTERS.map((f) => {
            const isActive = (f.key === "all" && !sessionType) || f.key === sessionType;
            const params = new URLSearchParams(searchParams as Record<string, string>);
            if (f.key === "all") params.delete("sessionType");
            else params.set("sessionType", f.key);
            if (q) params.set("q", q);
            return (
              <Link key={f.key} href={`/admin/matches?${params.toString()}`}>
                <span className={`rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                    : "border-line-200/40 bg-line-50 text-line-500 hover:border-line-300"
                }`}>
                  {f.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 선수 검색 */}
      <section className="mb-4">
        <form method="GET" action="/admin/matches">
          {sessionType && <input type="hidden" name="sessionType" value={sessionType} />}
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="선수명 검색"
              className="h-9 flex-1 rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-500"
            />
            <button type="submit"
              className="rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-600">
              검색
            </button>
            {q && (
              <Link href={`/admin/matches${sessionType ? `?sessionType=${sessionType}` : ""}`}
                className="rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-500 leading-9">
                초기화
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* 경기 목록 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Recent Matches
            <span className="ml-1.5 text-line-400">({matches.length})</span>
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              No Matches
            </p>
            <p className="mt-1 text-sm text-line-500">
              {q ? `"${q}" 검색 결과가 없습니다.` : "아직 등록된 경기가 없어요."}
            </p>
            <Link href="/matches/new"
              className="mt-3 inline-block rounded-sm border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400">
              첫 경기 입력 →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <div key={match.id} className="relative">
                <MatchCard match={match} />
                {/* 경기 수정 링크 */}
                {access.isAdmin && (
                  <Link
                    href={`/admin/matches/${match.id}/edit`}
                    className="absolute right-3 top-3 rounded-sm border border-line-200/40 bg-line-50 px-2 py-0.5 text-[10px] font-semibold text-line-500 hover:border-line-300 hover:text-line-700"
                  >
                    수정
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
