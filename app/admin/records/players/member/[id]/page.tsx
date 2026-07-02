import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";

export default async function MemberRecordPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const memberId = params.id;
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: member },
    { data: allMatches },
    { data: attendanceRows },
    { data: allSessions },
    { data: pointHistory },
    { data: allMembers },
  ] = await Promise.all([
    supabase.from("members").select("id, name, member_type, league_point").eq("id", memberId).maybeSingle(),
    supabase.from("matches").select("*").order("played_at", { ascending: false }),
    supabase.from("attendance").select("session_id, status").eq("member_id", memberId),
    supabase.from("attendance_sessions").select("id, title, session_date, session_day, status").neq("status", "archived"),
    supabase.from("point_history").select("*").eq("member_id", memberId).order("created_at", { ascending: true }),
    supabase.from("members").select("id, name").eq("is_active", true),
  ]);

  if (!member) {
    return (
      <main className="px-4 pt-6">
        <p className="text-sm text-line-400">회원을 찾을 수 없어요.</p>
        <Link href="/admin/records/players" className="mt-2 block text-xs text-clay-400">← 개인별 기록</Link>
      </main>
    );
  }

  const completedIds = new Set(
    (allSessions ?? []).filter((s) => s.status === "closed" || s.session_date < today).map((s) => s.id)
  );

  // 이 회원이 참여한 경기
  const myMatches = (allMatches ?? []).filter((m) => {
    const memberSlots = [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member];
    return memberSlots.includes(memberId);
  });

  // 승/패
  let wins = 0, losses = 0;
  const recentForms: string[] = [];
  for (const m of myMatches) {
    const isTeamA = [m.team_a_player1_member, m.team_a_player2_member].includes(memberId);
    const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
    if (isWin) wins++; else losses++;
    if (recentForms.length < 5) recentForms.push(isWin ? "W" : "L");
  }
  const games = wins + losses;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

  // 출석
  const attendMap = new Map((attendanceRows ?? []).map((r) => [r.session_id, r.status]));
  let attending = 0, absent = 0, undecided = 0;
  for (const [sid, status] of attendMap) {
    if (!completedIds.has(sid)) continue;
    if (status === "attending") attending++;
    else if (status === "absent") absent++;
    else undecided++;
  }

  // 세션별 참여자 집합 for 노쇼
  const participantsPerSession = new Map<string, Set<string>>();
  for (const m of allMatches ?? []) {
    if (!m.session_id) continue;
    if (!participantsPerSession.has(m.session_id)) participantsPerSession.set(m.session_id, new Set());
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
      .filter(Boolean).forEach((id) => participantsPerSession.get(m.session_id)!.add(id!));
  }

  let noShowCount = 0;
  for (const [sid, status] of attendMap) {
    if (!completedIds.has(sid)) continue;
    if (status === "attending" && !participantsPerSession.get(sid)?.has(memberId)) noShowCount++;
  }
  const noShowRate = attending > 0 ? Math.round((noShowCount / attending) * 100) : 0;
  const completedCount = completedIds.size;
  const attendRate = completedCount > 0 ? Math.round((attending / completedCount) * 100) : 0;
  // 미참여도 = 완료 매치 중 실제 경기 참여가 없는 비율
  const gameSessionIds = new Set(myMatches.map((m) => m.session_id).filter((sid): sid is string => !!sid && completedIds.has(sid)));
  const gameSessionCount = gameSessionIds.size;
  const participationRate = completedCount > 0 ? Math.round((gameSessionCount / completedCount) * 100) : 0;
  const absenceRate = completedCount > 0 ? 100 - participationRate : 0;

  // 최근 경기 (최대 10개)
  const sessionMap = new Map((allSessions ?? []).map((s) => [s.id, s]));
  const memberNameMap = new Map((allMembers ?? []).map((m) => [m.id, m.name]));
  const recentMatchItems = myMatches.slice(0, 10).map((m) => {
    const isTeamA = [m.team_a_player1_member, m.team_a_player2_member].includes(memberId);
    const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
    const session = m.session_id ? sessionMap.get(m.session_id) : null;
    const partner = isTeamA
      ? [m.team_a_player1_member, m.team_a_player2_member].find((id) => id && id !== memberId)
      : [m.team_b_player1_member, m.team_b_player2_member].find((id) => id && id !== memberId);
    const opponents = isTeamA
      ? [m.team_b_player1_member, m.team_b_player2_member].filter(Boolean)
      : [m.team_a_player1_member, m.team_a_player2_member].filter(Boolean);
    return {
      m, isTeamA, isWin, session,
      partnerName: partner ? (memberNameMap.get(partner) ?? "알수없음") : null,
      opponentNames: opponents.map((id) => memberNameMap.get(id!) ?? "알수없음"),
    };
  });

  const memberTypeLabel: Record<string, string> = { 정회원: "정회원", 준회원: "준회원", 게스트: "게스트" };

  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Player Records</p>
          <h1 className="headline-kr text-4xl text-line-900">{member.name}</h1>
          <p className="mt-1 text-xs text-line-500">{memberTypeLabel[member.member_type] ?? member.member_type}</p>
        </div>
        <Link href="/admin/records/players"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 개인별 기록
        </Link>
      </header>

      {/* Summary Cards */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{games}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">총 경기</p>
              <p className="text-[10px] text-line-400">{wins}승 {losses}패</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-gold">{winRate}%</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">승률</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{attending}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">출석</p>
              <p className="text-[10px] text-line-400">미정 {undecided} · 불참 {absent}</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{member.league_point}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">현재 LP</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{attendRate}%</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">출석률</p>
              <p className="text-[10px] text-line-400">완료 매치 {completedCount}개 기준</p>
            </div>
            {noShowCount > 0 && (
              <div className="px-5 py-4">
                <p className="font-score text-4xl font-bold tabular-nums text-clay-400">{noShowRate}%</p>
                <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">경기 미참여</p>
                <p className="text-[10px] text-line-400">출석 {attending}회 중 {noShowCount}회</p>
              </div>
            )}
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{participationRate}%</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">참여율</p>
              <p className="text-[10px] text-line-400">완료 {completedCount}매치 중 {gameSessionCount}회</p>
            </div>
            {absenceRate > 0 && (
              <div className="px-5 py-4">
                <p className="font-score text-4xl font-bold tabular-nums text-clay-400">{absenceRate}%</p>
                <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">미참여도</p>
                <p className="text-[10px] text-line-400">실제 경기 기록 없는 완료 매치 비율</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 최근 폼 */}
      {recentForms.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">최근 폼</p>
          <div className="flex items-center gap-2">
            {recentForms.map((f, i) => (
              <span key={i} className={`font-score rounded-sm px-2.5 py-1 text-sm font-bold ${f === "W" ? "bg-gold/10 text-gold" : "bg-line-200/40 text-line-500"}`}>
                {f}
              </span>
            ))}
            <span className="text-[10px] text-line-400">최근 {recentForms.length}경기</span>
          </div>
        </section>
      )}

      {/* LP 히스토리 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">LP 히스토리</p>
        {!(pointHistory ?? []).length ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">LP 히스토리 없음</p>
            <p className="text-[10px] text-line-400">경기 결과 입력 후 LP가 집계되면 표시됩니다.</p>
          </div>
        ) : (() => {
          const pts = (pointHistory ?? []);
          const values = pts.map((p) => p.point_after);
          const minV = Math.min(...values);
          const maxV = Math.max(...values);
          const range = maxV - minV || 1;
          const W = 320, H = 90, pad = 12;
          const xs = pts.map((_, i) => pad + (i / Math.max(pts.length - 1, 1)) * (W - pad * 2));
          const ys = values.map((v) => H - pad - ((v - minV) / range) * (H - pad * 2));
          const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
          const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1];
          return (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="px-4 pt-3">
                <div className="flex items-center justify-between text-[10px] text-line-400">
                  <span className="font-score">{minV} LP</span>
                  <span className="font-score font-bold text-gold">{maxV} LP</span>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-1 block">
                  <path d={pathD} fill="none" stroke="#B9A64B" strokeWidth="1.5" strokeLinejoin="round" />
                  {pts.length > 1 && (
                    <circle cx={lastX} cy={lastY} r="3" fill="#B9A64B" />
                  )}
                </svg>
              </div>
              <div className="border-t border-line-200/30 px-4 pb-3 pt-2">
                <p className="text-[10px] text-line-400">{pts[0]?.created_at.slice(0, 10)} – {pts[pts.length - 1]?.created_at.slice(0, 10)}</p>
              </div>
              {/* 최근 변동 10개 리스트 */}
              <div className="border-t border-line-200/30">
                {[...pts].reverse().slice(0, 5).map((ph, idx, arr) => (
                  <div key={ph.id}
                    className={`flex items-center justify-between px-4 py-2 ${idx < arr.length - 1 ? "border-b border-line-200/20" : ""}`}>
                    <div>
                      <p className="text-xs text-line-700">{ph.reason}</p>
                      <p className="text-[9px] text-line-400">{ph.created_at.slice(0, 10)}</p>
                    </div>
                    <p className={`font-score text-sm font-bold tabular-nums ${ph.point_change >= 0 ? "text-gold" : "text-clay-400"}`}>
                      {ph.point_change >= 0 ? "+" : ""}{ph.point_change}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* 최근 경기 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">최근 경기</p>
        {recentMatchItems.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {recentMatchItems.map(({ m, isTeamA, isWin, session, partnerName, opponentNames }, idx) => (
              <div key={m.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx < recentMatchItems.length - 1 ? "border-b border-line-200/30" : ""}`}>
                <span className={`font-score rounded-sm px-2 py-0.5 text-[11px] font-bold ${isWin ? "bg-gold/10 text-gold" : "bg-line-200/40 text-line-500"}`}>
                  {isWin ? "W" : "L"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-line-900">
                    {session ? (MATCH_SESSION_DAY_LABEL[session.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? session.title) : m.played_at}
                  </p>
                  <p className="font-score text-[10px] tabular-nums text-line-400">
                    {isTeamA ? "청팀" : "우팀"} · {m.score_a}:{m.score_b}
                  </p>
                  {(partnerName || opponentNames.length > 0) && (
                    <p className="text-[10px] text-line-400">
                      {partnerName && `파트너: ${partnerName}`}
                      {partnerName && opponentNames.length > 0 && " · "}
                      {opponentNames.length > 0 && `상대: ${opponentNames.join(", ")}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 출석 후 경기 미참여 */}
      {noShowCount > 0 && (
        <section className="mb-5">
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">출석 후 경기 미참여</p>
            <p className="mt-2 font-score text-3xl font-bold tabular-nums text-clay-400">{noShowRate}%</p>
            <p className="text-[10px] text-line-400">출석 {attending}회 중 {noShowCount}회 경기 기록 없음</p>
            <p className="mt-1 text-[9px] text-line-400">부상·대기·운영 인원이 포함될 수 있습니다.</p>
          </div>
        </section>
      )}

    </main>
  );
}
