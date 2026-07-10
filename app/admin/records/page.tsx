import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { pct, fmtPct, buildRecordsDashboardSummary, buildManagementAlerts } from "@/lib/records/dashboardUtils";
import type { MemberType } from "@/lib/supabase/database.types";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
  const badgeStyle = {
    borderColor: "var(--admin-border)",
    background: "var(--admin-surface-raised, var(--admin-surface))",
    color: "var(--admin-muted)",
  };
  if (isGuest) return (
    <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={badgeStyle}>
      게스트
    </span>
  );
  if (memberType === "준회원") return (
    <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={{ ...badgeStyle, opacity: 0.75 }}>
      준회원
    </span>
  );
  return null;
}

export default async function AdminRecordsPage() {
  const supabase = createClient();
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";
  const today = todayStr();

  const [
    { data: allSessions },
    { data: allMatches },
    { data: members },
    { data: guests },
    { data: allAttendance },
  ] = await Promise.all([
    supabase.from("attendance_sessions").select("*").eq("club_id", currentClubId).neq("status", "archived").order("session_date", { ascending: false }),
    supabase.from("matches").select("*").eq("club_id", currentClubId),
    supabase.from("members").select("id, name, member_type").eq("is_active", true).eq("club_id", currentClubId),
    supabase.from("guests").select("id, name").eq("is_active", true).eq("club_id", currentClubId).is("converted_to_member_id", null),
    supabase.from("attendance").select("session_id, member_id, status"),
  ]);

  const sessions   = allSessions ?? [];
  const matches    = allMatches  ?? [];
  const today_str  = today;

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

  const actionList = completed.filter((s) => !matchCountBySession.get(s.id)).slice(0, 10);
  const recentSessions = completed.slice(0, 8);

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

  function matchTitle(s: { session_day: string; title: string }) {
    const base = MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? s.title;
    return (s.session_day === "holiday" || s.session_day === "custom") ? `${base} · ${s.title}` : base;
  }

  const surfaceStyle = { background: "var(--admin-surface)", borderColor: "var(--admin-border)" };
  const borderStyle  = { borderColor: "var(--admin-border)" };

  return (
    <main className="px-4 pt-6 pb-28">

      <AdminPageHeader
        eyebrow="RECORDS"
        title="기록 대시보드"
        description="매치, 경기, 참여 현황을 확인합니다."
      />

      {/* ── KPI 요약 카드 ──────────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          요약
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "완료 매치",       value: String(kpi.completedCount),          sub: "기록 대상" },
            { label: "전체 경기",       value: String(kpi.totalGames),              sub: "세션 연결 경기" },
            { label: "평균 경기 참여율", value: fmtPct(kpi.avgParticipationRate),   sub: "완료 매치 기준" },
            { label: "평균 출석 체크율", value: fmtPct(kpi.avgAttendRate),          sub: "완료 매치 기준" },
            { label: "확인 필요",       value: String(kpi.needsCheckCount),         sub: "검수 필요 매치", warn: kpi.needsCheckCount > 0 },
            { label: "기록 부족",       value: String(kpi.missingRecordCount),      sub: "경기 기록 없음", warn: kpi.missingRecordCount > 0 },
            { label: "출석 후 미참여",   value: kpi.totalNoShow > 0 ? `${kpi.totalNoShow}건` : "없음", sub: "전체 누적", warn: kpi.totalNoShow > 0 },
          ].map((card) => (
            <div
              key={card.label}
              className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border px-4 py-3"
              style={surfaceStyle}
            >
              <p
                className="font-score text-3xl font-bold tabular-nums"
                style={{ color: "warn" in card && card.warn ? "var(--admin-accent)" : "var(--admin-text)" }}
              >
                {card.value}
              </p>
              <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                {card.label}
              </p>
              <p className="text-[9px]" style={{ color: "var(--admin-muted)", opacity: 0.65 }}>{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Management Alerts ────────────────────────────────────── */}
      {(alerts.sessionAlerts.length > 0 || alerts.playerAlerts.length > 0) && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            확인 필요
          </p>

          {alerts.sessionAlerts.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-[var(--admin-card-radius,14px)] border border-clay-400/30 bg-clay-400/5">
              <div className="flex items-center justify-between border-b border-clay-400/20 px-4 py-2">
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-clay-400">
                  경기 확인 필요 {alerts.sessionAlerts.length}건
                </p>
                <Link href="/admin/records/matches" className="text-[10px] font-semibold text-clay-400 hover:underline">
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
                        <p className="text-[14px] font-semibold" style={{ color: "var(--admin-text)" }}>{name}</p>
                        <p className="font-score text-[10px] tabular-nums" style={{ color: "var(--admin-muted)" }}>{a.session_date}</p>
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

          {alerts.playerAlerts.length > 0 && (
            <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
              <div className="flex items-center justify-between border-b px-4 py-2" style={borderStyle}>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                  미참여도 높은 선수
                </p>
                <Link href="/admin/records/players" className="text-[10px] font-semibold text-clay-400 hover:underline">
                  개인 기록 →
                </Link>
              </div>
              {alerts.playerAlerts.map((p, idx) => (
                <Link key={p.id} href={`/admin/records/players/member/${p.id}`}>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 transition-opacity hover:opacity-70"
                    style={idx < alerts.playerAlerts.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
                  >
                    <span className="text-[14px] font-semibold" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>참여 {p.gameSessionCount}/{p.totalCompleted}매치</span>
                    <span className="ml-auto text-sm font-bold text-clay-400">
                      <span className="font-score tabular-nums">{p.absenceRate}%</span>
                      <span className="unit-kr ml-0.5">미참여</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── BIG SCOREBOARD ─────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          스코어보드
        </p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
          <div className="grid grid-cols-2 divide-x divide-y divide-[color:var(--admin-border)]">
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{sessions.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>총 매치</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>archived 제외</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{gamesWithSession}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>총 경기</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>세션 연결 경기</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-5xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{completed.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>완료 매치</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>closed + 날짜 지난</p>
            </div>
            <div className="px-5 py-4">
              <p
                className="font-score text-5xl font-bold tabular-nums"
                style={{ color: missingCount > 0 ? "var(--admin-accent)" : "var(--admin-muted)" }}
              >
                {missingCount}
              </p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>결과 미입력</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>완료됐지만 기록 없음</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPLETION BAR ─────────────────────────────────────── */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border px-5 py-4" style={surfaceStyle}>
          <div className="mb-2 flex items-end justify-between">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>기록 입력률</p>
            <p className="font-score text-2xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{completionPct}%</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--admin-surface-raised, var(--admin-surface-strong))" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${completionPct}%`, background: "var(--admin-achievement)", opacity: 0.7 }}
            />
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--admin-muted)" }}>
            완료 매치 {completed.length}개 중 {filledCount}개 경기 결과 입력 완료
          </p>
        </div>
      </section>

      {/* ── ACTION REQUIRED ────────────────────────────────────── */}
      {actionList.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            결과 입력 필요
          </p>
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border border-clay-400/40 bg-clay-400/5">
            <div className="flex items-center gap-2 border-b border-clay-400/30 px-4 py-2.5">
              <span className="font-score text-lg font-bold tabular-nums text-clay-400">{actionList.length}</span>
              <span className="text-xs font-semibold text-clay-400">개 매치 경기 결과 미입력</span>
            </div>
            {actionList.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3"
                style={idx < actionList.length - 1 ? { borderBottom: "1px solid rgba(212,255,61,0.12)" } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{matchTitle(s)}</p>
                  <p className="font-score text-[10px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>{s.session_date}</p>
                </div>
                <Link
                  href={`/admin/matches/new?sessionId=${s.id}`}
                  className="ml-3 flex-shrink-0 rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/20"
                >
                  결과 입력
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RECENT MATCH HISTORY ───────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          최근 매치
        </p>
        {recentSessions.length === 0 ? (
          <div className="rounded-[var(--admin-card-radius,14px)] border p-4 text-center" style={surfaceStyle}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>완료된 매치가 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
            {recentSessions.map((s, idx) => {
              const cnt = matchCountBySession.get(s.id) ?? 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={idx < recentSessions.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{matchTitle(s)}</p>
                    <p className="font-score text-[10px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>{s.session_date}</p>
                  </div>
                  {cnt > 0 ? (
                    <span className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>
                      <span className="font-score tabular-nums">{cnt}</span>
                      <span className="unit-kr">경기</span>
                    </span>
                  ) : (
                    <span
                      className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
                    >
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
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            참여도 TOP 10
          </p>
          <Link
            href="/admin/records/players"
            className="rounded-[var(--admin-button-radius,6px)] border border-clay-400/30 px-2.5 py-1 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/10"
          >
            개인 기록 보기 →
          </Link>
        </div>
        {top10.length === 0 ? (
          <div className="rounded-[var(--admin-card-radius,14px)] border p-4 text-center" style={surfaceStyle}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
            {top10.map((p, idx) => {
              const barPct = Math.round((p.games / maxGames) * 100);
              return (
                <div
                  key={(p.isGuest ? "G:" : "M:") + p.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={idx < top10.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
                >
                  <span
                    className="w-5 flex-shrink-0 text-right font-score text-[13px] font-bold tabular-nums"
                    style={{ color: idx < 3 ? "var(--admin-achievement)" : "var(--admin-muted)" }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5">
                    <span className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                    <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                  </div>
                  <div
                    className="h-1 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--admin-surface-raised, var(--admin-surface-strong))" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barPct}%`, background: "var(--admin-muted)", opacity: 0.5 }}
                    />
                  </div>
                  <p className="flex-shrink-0 text-right text-[11px]">
                    <span className="font-score tabular-nums" style={{ color: "var(--admin-text)", opacity: 0.8 }}>{p.games}</span>
                    <span style={{ color: "var(--admin-muted)" }}>경기 · </span>
                    <span className="font-score tabular-nums" style={{ color: "var(--admin-achievement)" }}>{p.wins}</span>
                    <span style={{ color: "var(--admin-muted)" }}>승 </span>
                    <span className="font-score tabular-nums" style={{ color: "var(--admin-muted)" }}>{p.losses}</span>
                    <span style={{ color: "var(--admin-muted)" }}>패 · </span>
                    <span className="font-score tabular-nums" style={{ color: "var(--admin-muted)" }}>{p.winRate}%</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── QUICK LINKS ────────────────────────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          바로가기
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/records/players",   label: "선수 기록 분석" },
            { href: "/admin/records/matches",    label: "경기 검수" },
            { href: "/admin/records/attendance", label: "출석 체크 검수" },
            { href: "/admin/matches/new",        label: "결과 입력" },
            { href: "/admin/attendance",         label: "출석 관리" },
            { href: "/matches/history",          label: "매치 히스토리" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-[var(--admin-button-radius,6px)] border border-clay-400/30 px-3 py-1.5 text-xs font-semibold text-clay-400 hover:bg-clay-400/10"
            >
              {l.label} →
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
