import Link from "next/link";
import { DeleteMatchButton } from "./DeleteMatchButton";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches, type DisplayMatch } from "@/lib/match-display";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { TEAM_LABEL } from "@/lib/match-team-labels";
import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * /admin/matches — 관리자 전용 경기 관리 페이지.
 * 공개 MatchCard 대신 관리/검수 중심 AdminMatchCard 사용.
 * 청팀/우팀 표기 통일. 선수명은 Noto Sans KR.
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

// ── 관리자 경기 카드 ────────────────────────────────────────────────
function AdminMatchCard({
  match,
  canEdit,
  canDelete,
}: {
  match: DisplayMatch;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const winner = match.winner_team as "A" | "B" | null | undefined ?? null;
  const isAWin = winner === "A";
  const isBWin = winner === "B";

  const sessionLabel =
    match.sessionTitle
    ?? (match.sessionDay ? MATCH_SESSION_DAY_LABEL[match.sessionDay] : null)
    ?? "세션 정보 없음";

  const EMPTY_NAMES = new Set(["", "알수없음", "알 수 없음", "unknown", "Unknown"]);
  const playerName = (name: string | null | undefined) =>
    name && !EMPTY_NAMES.has(name) ? name : "선수 미지정";

  const scoreDisplay =
    match.score_a != null && match.score_b != null
      ? `${match.score_a} : ${match.score_b}${
          match.score_a_tiebreak != null
            ? ` (${match.score_a_tiebreak}–${match.score_b_tiebreak})`
            : ""
        }`
      : "스코어 미입력";

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      {/* 상단 메타 */}
      <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
            {match.played_at}
          </span>
          <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
            {sessionLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {canDelete && (
            <DeleteMatchButton matchId={match.id} playedAt={match.played_at} />
          )}
          {canEdit && (
            <Link
              href={`/admin/matches/${match.id}/edit`}
              className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400"
            >
              수정
            </Link>
          )}
        </div>
      </div>

      {/* 경기 본문 */}
      <div className="px-4 py-3">
        {/* 스코어 + 승리팀 */}
        <div className="mb-3 flex items-center justify-center gap-4">
          {/* 청팀 */}
          <div className={`flex flex-col items-center ${winner && !isAWin ? "opacity-50" : ""}`}>
            <span className="text-[10px] font-bold text-clay-400">
              {TEAM_LABEL["A"]}
            </span>
            <span className={`font-score text-3xl font-bold tabular-nums ${isAWin ? "text-gold" : "text-line-500"}`}>
              {match.score_a ?? "—"}
            </span>
            {isAWin && winner && (
              <span className="mt-0.5 rounded-sm bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                WIN
              </span>
            )}
          </div>

          <span className="font-score text-lg font-bold text-line-400">:</span>

          {/* 우팀 */}
          <div className={`flex flex-col items-center ${winner && !isBWin ? "opacity-50" : ""}`}>
            <span className="text-[10px] font-bold text-clay-400">
              {TEAM_LABEL["B"]}
            </span>
            <span className={`font-score text-3xl font-bold tabular-nums ${!isAWin ? "text-gold" : "text-line-500"}`}>
              {match.score_b ?? "—"}
            </span>
            {isBWin && winner && (
              <span className="mt-0.5 rounded-sm bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                WIN
              </span>
            )}
          </div>
        </div>

        {match.score_a_tiebreak != null && (
          <p className="mb-2 text-center text-[10px] text-line-400">
            타이브레이크 {match.score_a_tiebreak}–{match.score_b_tiebreak}
          </p>
        )}

        {/* 선수 명단 */}
        <div className="grid grid-cols-2 gap-2">
          {/* 청팀 선수 */}
          <div className={`rounded-sm border p-2.5 ${isAWin && winner ? "border-gold/30 bg-gold/5" : "border-line-200/30"}`}>
            <p className="mb-1 text-[10px] font-semibold text-line-400">
              {TEAM_LABEL["A"]}
            </p>
            <p className="text-[15px] font-semibold leading-snug text-line-900 break-words">
              {playerName(match.teamAPlayer1.name)}
            </p>
            <p className="text-[15px] font-semibold leading-snug text-line-900 break-words">
              {playerName(match.teamAPlayer2.name)}
            </p>
          </div>

          {/* 우팀 선수 */}
          <div className={`rounded-sm border p-2.5 ${isBWin && winner ? "border-gold/30 bg-gold/5" : "border-line-200/30"}`}>
            <p className="mb-1 text-[10px] font-semibold text-line-400">
              {TEAM_LABEL["B"]}
            </p>
            <p className="text-[15px] font-semibold leading-snug text-line-900 break-words">
              {playerName(match.teamBPlayer1.name)}
            </p>
            <p className="text-[15px] font-semibold leading-snug text-line-900 break-words">
              {playerName(match.teamBPlayer2.name)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────────
export default async function AdminMatchesPage({ searchParams }: PageProps) {
  const access = await getAdminAccessServer();
  const supabase = createClient();

  const rawType = searchParams.sessionType ?? "all";
  const sessionType = VALID_SESSION_TYPES.includes(rawType as SessionDay)
    ? (rawType as SessionDay) : null;
  const q = searchParams.q?.trim() ?? "";

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
    query = ids.length > 0
      ? query.in("session_id", ids)
      : query.is("session_id", null);
  }

  const { data: rawMatches } = await query;
  let matches = toDisplayMatches(rawMatches ?? []);

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
          <h1 className="headline-kr text-4xl text-line-900">경기 기록</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-5 text-sm text-line-500">
        매치 기록을 확인하고 수정합니다. 신규 매치는 매치 생성에서 입력합니다.
      </p>

      {/* 빠른 작업 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Quick Actions
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/admin/matches/new", label: "매치 생성", sub: "New Match",   accent: "clay" },
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
            const params = new URLSearchParams(
              Object.fromEntries(
                Object.entries(searchParams as Record<string, string>).filter(([, v]) => v)
              )
            );
            if (f.key === "all") params.delete("sessionType");
            else params.set("sessionType", f.key);
            if (q) params.set("q", q); else params.delete("q");
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
      <section className="mb-5">
        <form method="GET" action="/admin/matches">
          {sessionType && <input type="hidden" name="sessionType" value={sessionType} />}
          <div className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="선수명 검색"
              className="h-9 flex-1 rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-500" />
            <button type="submit"
              className="rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-600">
              검색
            </button>
            {q && (
              <Link
                href={`/admin/matches${sessionType ? `?sessionType=${sessionType}` : ""}`}
                className="flex items-center rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-500">
                초기화
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* 경기 목록 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
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
            <Link href="/admin/matches/new"
              className="mt-3 inline-block rounded-sm border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400">
              첫 경기 입력 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <AdminMatchCard
                key={match.id}
                match={match}
                canEdit={access.isAdmin}
                canDelete={access.isOwner}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
