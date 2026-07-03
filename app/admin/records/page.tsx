import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { pct, fmtPct, buildRecordsDashboardSummary, buildManagementAlerts } from "@/lib/records/dashboardUtils";
import type { MemberType } from "@/lib/supabase/database.types";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface PlayerStat {
  id: string;
  name: string;
  isGuest: boolean;
  memberType: MemberType | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
      게스트
    </span>
  );
  if (memberType === "준회원") return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
      준회원
    </span>
  );
  return null;
}

export default async function AdminRecordsPage() {
  const supabase = createClient();
  const today = todayStr();

  const [
    { data: allSessions },
    { data: allMatches },
    { data: members },
    { data: guests },
    { data: allAttendance },
  ] = await Promise.all([
    supabase.from("attendance_sessions").select("*").eq("club_id", CHEONGWOO_CLUB_ID).neq("status", "archived").order("session_date", { ascending: false }),
    supabase.from("matches").select("*").eq("club_id", CHEONGWOO_CLUB_ID),
    supabase.from("members").select("id, name, member_type").eq("is_active", true).eq("club_id", CHEONGWOO_CLUB_ID),
    supabase.from("guests").select("id, name").eq("is_active", true).eq("club_id", CHEONGWOO_CLUB_ID).is("converted_to_member_id", null),
    supabase.from("attendance").select("session_id, member_id, status"),
  ]);

  const sessions   = allSessions ?? [];
  const matches    = allMatches  ?? [];
  const today_str  = today;

  // ── 통계 계산 ──────────────────────────────────────────────────
  const completed = sessions.filter(
    (s) => s.status === "closed" || s.session_date < today_str
  );
  const matchCountBySession = new Map<string, number>();
  for (const m of matches) {
    if (m.session_id) matchCountBySession.set(m.session_id, (matchCountBySession.get(m.session_id) ?? 0) + 1);
  }
  const gamesWithSession   = matches.filter((m) => m.session_id).length;
  const missingCount       = completed.filter((s) => !matchCountBySession.get(s.id)).length;
  const filledCount        = completed.length - missingCount;
  const completionPct      = completed.length > 0 ? Math.round((filledCount / completed.length) * 100) : 0;

  // Action Required (최대 10개)
  const actionList = completed.filter((s) => !matchCountBySession.get(s.id)).slice(0, 10);

  // 최근 매치 8개
  const recentSessions = completed.slice(0, 8);

  // ── 참여도 TOP 10 계산 ──────────────────────────────────────────
  const memberMap = new Map((members ?? []).map((m) => [m.id, { name: m.name, memberType: m.member_type as MemberType }]));
  const guestMap  = new Map((guests  ?? []).map((g) => [g.id, g.name]));
  const statMap   = new Map<string, PlayerStat>();

  function addResult(id: string | null, isGuest: boolean, isWin: boolean) {
    if (!id) return;
    const key  = (isGuest ? "G:" : "M:") + id;
    const info = isGuest
      ? { name: guestMap.get(id) ?? "게스트", memberType: null }
      : { name: memberMap.get(id)?.name ?? "알수없음", memberType: memberMap.get(id)?.memberType ?? null };
    const prev = statMap.get(key) ?? { id, name: info.name, isGuest, memberType: info.memberType, games: 0, wins: 0, losses: 0, winRate: 0 };
    const wins   = prev.wins   + (isWin ? 1 : 0);
    const losses = prev.losses + (isWin ? 0 : 1);
    statMap.set(key, { ...prev, wins, losses, games: wins + losses, winRate: Math.round((wins / (wins + losses)) * 100) });
  }

  for (const m of matches) {
    const aWin = m.winner_team === "A";
    addResult(m.team_a_player1_member, false, aWin);
    addResult(m.team_a_player2_member, false, aWin);
    addResult(m.team_a_player1_guest,  true,  aWin);
    addResult(m.team_a_player2_guest,  true,  aWin);
    addResult(m.team_b_player1_member, false, !aWin);
    addResult(m.team_b_player2_member, false, !aWin);
    addResult(m.team_b_player1_guest,  true,  !aWin);
    addResult(m.team_b_player2_guest,  true,  !aWin);
  }

  const top10 = [...statMap.values()]
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.wins - a.wins || a.name.localeCompare(b.name, "ko"))
    .slice(0, 10);

  const maxGames = top10[0]?.games ?? 1;

  // ── KPI 요약 + Management Alerts ────────────────────────────────
  const kpi = buildRecordsDashboardSummary(
    sessions,
    matches,
    allAttendance ?? [],
    today_str,
    (members ?? []).length,
  );
  const alerts = buildManagementAlerts(
    sessions,
    matches,
    allAttendance ?? [],
    (members ?? []).map((m) => ({ id: m.id, name: m.name })),
    today_str,
  );

  // ── 매치명 헬퍼 ────────────────────────────────────────────────
  function matchTitle(s: { session_day: string; title: string }) {
    const base = MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? s.title;
    return (s.session_day === "holiday" || s.session_day === "custom") ? `${base} · ${s.title}` : base;
  }

  return (
    <main className="px-4 pt-6 pb-28">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">기록 대시보드</h1>
          <p className="mt-1 max-w-[280px] break-keep text-xs leading-relaxed text-line-500">매치, 경기, 참여 현황을 확인합니다.</p>
        </div>
        <Link href="/admin"
          className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      {/* ── KPI 요약 카드 ──────────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Summary</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "완료 매치",    value: String(kpi.completedCount),             sub: "기록 대상" },
            { label: "전체 경기",    value: String(kpi.totalGames),                  sub: "세션 연결 경기" },
            { label: "평균 경기 참여율", value: fmtPct(kpi.avgParticipationRate),      sub: "완료 매치 기준" },
            { label: "평균 출석 체크율", value: fmtPct(kpi.avgAttendRate),            sub: "완료 매치 기준" },
            { label: "확인 필요",    value: String(kpi.needsCheckCount),             sub: "검수 필요 매치", warn: kpi.needsCheckCount > 0 },
            { label: "기록 부족",    value: String(kpi.missingRecordCount),          sub: "경기 기록 없음", warn: kpi.missingRecordCount > 0 },
            { label: "출석 후 미참여", value: kpi.totalNoShow > 0 ? `${kpi.totalNoShow}건` : "없음", sub: "전체 누적", warn: kpi.totalNoShow > 0 },
          ].map((card) => (
            <div key={card.label} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3">
              <p className={`font-score text-3xl font-bold tabular-nums ${"warn" in card && card.warn ? "text-clay-400" : "text-line-900"}`}>{card.value}</p>
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">{card.label}</p>
              <p className="text-[9px] text-line-400">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Management Alerts ────────────────────────────────────── */}
      {(alerts.sessionAlerts.length > 0 || alerts.playerAlerts.length > 0) && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Management Alerts</p>

          {/* 경기 alerts */}
          {alerts.sessionAlerts.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-[14px] border border-clay-400/30 bg-clay-400/5">
              <div className="flex items-center justify-between border-b border-clay-400/20 px-4 py-2">
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-clay-400">
                  경기 확인 필요 {alerts.sessionAlerts.length}건
                </p>
                <Link href="/admin/records/matches"
                  className="text-[10px] font-semibold text-clay-400 hover:underline">
                  경기 검수 →
                </Link>
              </div>
              {alerts.sessionAlerts.map((a, idx) => {
                const base = MATCH_SESSION_DAY_LABEL[a.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? a.title;
                const name = (a.session_day === "holiday" || a.session_day === "custom") ? `${base} · ${a.title}` : base;
                return (
                  <Link key={a.id} href="/admin/records/matches">
                    <div className={`flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-clay-400/10 ${idx < alerts.sessionAlerts.length - 1 ? "border-b border-clay-400/10" : ""}`}>
                      <div>
                        <p className="text-[14px] font-semibold text-line-900">{name}</p>
                        <p className="font-score text-[10px] tabular-nums text-line-400">{a.session_date}</p>
                      </div>
                      <span className="rounded-sm border border-clay-400/40 bg-clay-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-clay-400">
                        {a.reason}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 선수 alerts */}
          {alerts.playerAlerts.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2">
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  미참여도 높은 선수
                </p>
                <Link href="/admin/records/players"
                  className="text-[10px] font-semibold text-line-500 hover:text-clay-400">
                  개인 기록 →
                </Link>
              </div>
              {alerts.playerAlerts.map((p, idx) => (
                <Link key={p.id} href={`/admin/records/players/member/${p.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < alerts.playerAlerts.length - 1 ? "border-b border-line-200/20" : ""}`}>
                    <span className="text-[14px] font-semibold text-line-900">{p.name}</span>
                    <span className="text-[10px] text-line-400">참여 {p.gameSessionCount}/{p.totalCompleted}매치</span>
                    <span className="ml-auto text-sm font-bold text-clay-400"><span className="font-score tabular-nums">{p.absenceRate}%</span><span className="unit-kr ml-0.5">미참여</span></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── BIG SCOREBOARD ─────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Scoreboard</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
            {/* 총 매치 */}
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums text-line-900">{sessions.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">총 매치</p>
              <p className="text-[10px] text-line-400">archived 제외</p>
            </div>
            {/* 총 경기 */}
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums text-line-900">{gamesWithSession}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">총 경기</p>
              <p className="text-[10px] text-line-400">세션 연결 경기</p>
            </div>
            {/* 완료 매치 */}
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums text-gold">{completed.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">완료 매치</p>
              <p className="text-[10px] text-line-400">closed + 날짜 지난</p>
            </div>
            {/* 결과 미입력 */}
            <div className="px-5 py-4">
              <p className={`font-score text-5xl font-bold tabular-nums ${missingCount > 0 ? "text-clay-400" : "text-line-400"}`}>
                {missingCount}
              </p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">결과 미입력</p>
              <p className="text-[10px] text-line-400">완료됐지만 기록 없음</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPLETION BAR ─────────────────────────────────────── */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-5 py-4">
          <div className="mb-2 flex items-end justify-between">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">기록 입력률</p>
            <p className="font-score text-2xl font-bold tabular-nums text-gold">{completionPct}%</p>
          </div>
          {/* progress bar */}
          <div className="h-1.5 overflow-hidden rounded-full bg-line-200/40">
            <div
              className="h-full rounded-full bg-gold/70 transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-line-400">
            완료 매치 {completed.length}개 중 {filledCount}개 경기 결과 입력 완료
          </p>
        </div>
      </section>

      {/* ── ACTION REQUIRED ────────────────────────────────────── */}
      {actionList.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Action Required
          </p>
          <div className="overflow-hidden rounded-[14px] border border-clay-400/40 bg-clay-400/5">
            {/* 섹션 헤더 */}
            <div className="flex items-center gap-2 border-b border-clay-400/30 px-4 py-2.5">
              <span className="font-score text-lg font-bold tabular-nums text-clay-400">{actionList.length}</span>
              <span className="text-xs font-semibold text-clay-400">개 매치 경기 결과 미입력</span>
            </div>
            {actionList.map((s, idx) => (
              <div key={s.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < actionList.length - 1 ? "border-b border-clay-400/20" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-line-900">{matchTitle(s)}</p>
                  <p className="font-score text-[10px] font-bold tabular-nums text-line-400">{s.session_date}</p>
                </div>
                <Link href={`/admin/matches/new?sessionId=${s.id}`}
                  className="ml-3 flex-shrink-0 rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/20">
                  결과 입력
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RECENT MATCH HISTORY ───────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          최근 매치
        </p>
        {recentSessions.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">완료된 매치가 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {recentSessions.map((s, idx) => {
              const cnt = matchCountBySession.get(s.id) ?? 0;
              return (
                <div key={s.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx < recentSessions.length - 1 ? "border-b border-line-200/30" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-line-900">{matchTitle(s)}</p>
                    <p className="font-score text-[10px] font-bold tabular-nums text-line-400">{s.session_date}</p>
                  </div>
                  {cnt > 0 ? (
                    <span className="text-sm font-bold text-line-600"><span className="font-score tabular-nums">{cnt}</span><span className="unit-kr">경기</span></span>
                  ) : (
                    <span className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
                      미입력
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── PARTICIPATION BOARD ────────────────────────────────── */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            참여도 TOP 10
          </p>
          <Link href="/admin/records/players"
            className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[10px] font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
            개인 기록 보기 →
          </Link>
        </div>
        {top10.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {top10.map((p, idx) => {
              const barPct = Math.round((p.games / maxGames) * 100);
              return (
                <div key={(p.isGuest ? "G:" : "M:") + p.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < top10.length - 1 ? "border-b border-line-200/30" : ""}`}>
                  {/* 순위 */}
                  <span className={`w-5 flex-shrink-0 text-right font-score text-[13px] font-bold tabular-nums ${idx < 3 ? "text-gold" : "text-line-400"}`}>
                    {idx + 1}
                  </span>
                  {/* 이름 + 배지 */}
                  <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5">
                    <span className="text-[15px] font-semibold leading-snug text-line-900">{p.name}</span>
                    <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                  </div>
                  {/* 미니바 */}
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-200/40">
                    <div className="h-full rounded-full bg-line-400/50" style={{ width: `${barPct}%` }} />
                  </div>
                  {/* 스탯 */}
                  <p className="flex-shrink-0 text-right text-[11px]">
                    <span className="font-score tabular-nums text-line-600">{p.games}</span>
                    <span className="text-line-400">경기 · </span>
                    <span className="font-score tabular-nums text-gold">{p.wins}</span>
                    <span className="text-line-500">승 </span>
                    <span className="font-score tabular-nums text-line-400">{p.losses}</span>
                    <span className="text-line-400">패 · </span>
                    <span className="font-score tabular-nums text-line-500">{p.winRate}%</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── QUICK LINKS ────────────────────────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Quick Links</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/records/players",   label: "선수 기록 분석" },
            { href: "/admin/records/matches",    label: "경기 검수" },
            { href: "/admin/records/attendance", label: "출석 체크 검수" },
            { href: "/admin/matches/new",        label: "결과 입력" },
            { href: "/admin/attendance",         label: "출석 관리" },
            { href: "/matches/history",          label: "매치 히스토리" },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="rounded-sm border border-line-200/40 px-3 py-1.5 text-xs font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
              {l.label} →
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
