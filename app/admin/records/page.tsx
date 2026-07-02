import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { MemberType } from "@/lib/supabase/database.types";

// ── 유틸 ─────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">게스트</span>
  );
  if (memberType === "준회원") return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">준회원</span>
  );
  return null;
}

// ── 참여자 기록 계산 ─────────────────────────────────────────────
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

export default async function AdminRecordsPage() {
  const supabase = createClient();
  const today = todayStr();

  // ── 데이터 병렬 조회 ─────────────────────────────────────────
  const [
    { data: allSessions },
    { data: allMatches },
    { data: members },
    { data: guests },
  ] = await Promise.all([
    supabase.from("attendance_sessions").select("*").neq("status", "archived").order("session_date", { ascending: false }),
    supabase.from("matches").select("*"),
    supabase.from("members").select("id, name, member_type").eq("is_active", true),
    supabase.from("guests").select("id, name").eq("is_active", true).is("converted_to_member_id", null),
  ]);

  const sessions = allSessions ?? [];
  const matches  = allMatches ?? [];

  // ── Summary 통계 ─────────────────────────────────────────────
  const completedSessions = sessions.filter(
    (s) => s.status === "closed" || s.session_date < today
  );
  const matchCountBySession = new Map<string, number>();
  for (const m of matches) {
    if (m.session_id) matchCountBySession.set(m.session_id, (matchCountBySession.get(m.session_id) ?? 0) + 1);
  }
  const unpendingCount = completedSessions.filter(
    (s) => (matchCountBySession.get(s.id) ?? 0) === 0
  ).length;

  // ── 결과 미입력 매치 ─────────────────────────────────────────
  const unpendingSessions = completedSessions.filter(
    (s) => (matchCountBySession.get(s.id) ?? 0) === 0
  ).slice(0, 10);  // 최대 10개 표시 (카드 수치와 근접)

  // ── 최근 완료 매치 리스트 ────────────────────────────────────
  const recentCompleted = completedSessions.slice(0, 8);

  // ── 참여자 TOP 10 ────────────────────────────────────────────
  const memberMap = new Map((members ?? []).map((m) => [m.id, { name: m.name, memberType: m.member_type as MemberType }]));
  const guestMap  = new Map((guests  ?? []).map((g) => [g.id, g.name]));
  const statMap   = new Map<string, PlayerStat>();

  function addResult(id: string | null, isGuest: boolean, isWin: boolean) {
    if (!id) return;
    const key = (isGuest ? "G:" : "M:") + id;
    const info = isGuest
      ? { name: guestMap.get(id) ?? "게스트", memberType: null }
      : { name: memberMap.get(id)?.name ?? "알수없음", memberType: memberMap.get(id)?.memberType ?? null };
    const prev = statMap.get(key) ?? { id, name: info.name, isGuest, memberType: info.memberType, games: 0, wins: 0, losses: 0, winRate: 0 };
    const wins   = prev.wins   + (isWin ? 1 : 0);
    const losses = prev.losses + (isWin ? 0 : 1);
    const games  = wins + losses;
    statMap.set(key, { ...prev, wins, losses, games, winRate: Math.round((wins / games) * 100) });
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
    .sort((a, b) => b.games - a.games || b.wins - a.wins || b.winRate - a.winRate || a.name.localeCompare(b.name, "ko"))
    .slice(0, 10);

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">기록 대시보드</h1>
          <p className="mt-1 text-sm text-line-500">매치, 참여, 경기 결과 현황을 한눈에 확인합니다.</p>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      {/* ── Summary Cards */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Summary</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "총 매치",     value: sessions.length,          sub: "archived 제외" },
            { label: "완료 매치",   value: completedSessions.length,  sub: "closed + 날짜 지난" },
            { label: "총 경기",     value: matches.filter(m => m.session_id).length, sub: "세션 연결 경기" },
            { label: "결과 미입력", value: unpendingCount,            sub: "완료됐지만 기록 없음" },
          ].map((card) => (
            <div key={card.label} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-900">{card.value}</p>
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">{card.label}</p>
              <p className="text-[9px] text-line-400">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 결과 미입력 매치 */}
      {unpendingSessions.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Action Required
          </p>
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {unpendingSessions.map((s, idx) => (
              <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${idx < unpendingSessions.length - 1 ? "border-b border-line-200/30" : ""}`}>
                <div>
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL]}
                    {(s.session_day === "holiday" || s.session_day === "custom") && ` · ${s.title}`}
                  </p>
                  <p className="text-xs text-line-400">{s.session_date}</p>
                </div>
                <Link href="/admin/matches/new"
                  className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/20">
                  결과 입력
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 최근 매치 기록 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">최근 매치</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {recentCompleted.length === 0 ? (
            <p className="px-4 py-3 text-sm text-line-400">완료된 매치가 없어요.</p>
          ) : recentCompleted.map((s, idx) => {
            const cnt = matchCountBySession.get(s.id) ?? 0;
            return (
              <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${idx < recentCompleted.length - 1 ? "border-b border-line-200/30" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL]}
                    {(s.session_day === "holiday" || s.session_day === "custom") && ` · ${s.title}`}
                  </p>
                  <p className="text-xs text-line-400">{s.session_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  {cnt > 0 ? (
                    <span className="font-score text-[11px] tabular-nums text-line-500">{cnt}경기</span>
                  ) : (
                    <span className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">미입력</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 참여자 TOP 10 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">참여자 TOP 10</p>
        {top10.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {top10.map((p, idx) => (
              <div key={(p.isGuest ? "G:" : "M:") + p.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx < top10.length - 1 ? "border-b border-line-200/30" : ""}`}>
                <span className="font-score w-5 text-right text-[11px] font-bold tabular-nums text-line-400">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold leading-snug text-line-900">{p.name}</span>
                    <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                  </div>
                </div>
                <p className="shrink-0 text-right text-[11px]">
                  <span className="font-score tabular-nums text-line-500">{p.games}</span>
                  <span className="text-line-400">경기 · </span>
                  <span className="font-score tabular-nums text-gold">{p.wins}</span>
                  <span className="text-line-500">승 </span>
                  <span className="font-score tabular-nums text-line-400">{p.losses}</span>
                  <span className="text-line-400">패 · </span>
                  <span className="font-score tabular-nums text-line-500">{p.winRate}%</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Quick Links */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Quick Links</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/matches",     label: "경기 기록 관리" },
            { href: "/admin/matches/new", label: "경기 결과 입력" },
            { href: "/admin/attendance",  label: "출석 관리" },
            { href: "/matches/history",   label: "매치 히스토리" },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="rounded-sm border border-line-200/40 px-3 py-1.5 text-xs font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
              {l.label}
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
