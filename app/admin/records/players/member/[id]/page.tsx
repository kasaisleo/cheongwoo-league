import { notFound } from "next/navigation";
import { pct, fmtPct } from "@/lib/records/dashboardUtils";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { getAdminAccessServer } from "@/lib/admin-permissions";

// ── 매치명 헬퍼 ─────────────────────────────────────────────────
function matchTitle(s: { session_day: string; title: string }) {
  const base = MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? s.title;
  return (s.session_day === "holiday" || s.session_day === "custom") ? `${base} · ${s.title}` : base;
}

// ── 페이지 ──────────────────────────────────────────────────────
export default async function MemberRecordPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // point_history_select_all(anon 공개 SELECT) 정책 삭제 이후에도 Admin 조회가
  // 끊기지 않도록, 이 한 쿼리만 RLS를 우회하는 service-role로 조회한다.
  // club_id/member_id는 반드시 서버에서 도출한 access.clubId와 URL의 memberId만
  // 쓴다 — 브라우저가 넘긴 club_id는 없고 있어도 무시한다.
  const serviceSupabase = createServiceClient();
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";
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
    supabase.from("members").select("id, name, member_type, league_point").eq("id", memberId).eq("club_id", currentClubId).maybeSingle(),
    supabase.from("matches").select("*").eq("club_id", currentClubId).order("played_at", { ascending: false }),
    supabase.from("attendance").select("session_id, status").eq("member_id", memberId),
    supabase.from("attendance_sessions").select("id, title, session_date, session_day, status").eq("club_id", currentClubId).neq("status", "archived"),
    serviceSupabase
      .from("point_history")
      .select("*")
      .eq("club_id", currentClubId)
      .eq("member_id", memberId)
      .order("created_at", { ascending: true }),
    supabase.from("members").select("id, name").eq("is_active", true).eq("club_id", currentClubId),
  ]);

  if (!member) {
    // memberId가 존재하지 않거나 다른 club 소속이면(위 쿼리가 club_id로 이미 scope됨)
    // 진짜 404를 반환한다 — 커스텀 200 안내 화면으로 존재 여부를 흘리지 않는다.
    notFound();
  }

  // ── 완료 매치 집합 ────────────────────────────────────────────
  const completedIds = new Set(
    (allSessions ?? []).filter((s) => s.status === "closed" || s.session_date < today).map((s) => s.id)
  );
  const completedCount = completedIds.size;

  // ── 내 경기 ──────────────────────────────────────────────────
  const myMatches = (allMatches ?? []).filter((m) => {
    return [m.team_a_player1_member, m.team_a_player2_member,
            m.team_b_player1_member, m.team_b_player2_member].includes(memberId);
  });

  let wins = 0, losses = 0;
  const recentForms: string[] = [];
  for (const m of myMatches) {
    const isTeamA = [m.team_a_player1_member, m.team_a_player2_member].includes(memberId);
    const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
    if (isWin) wins++; else losses++;
    if (recentForms.length < 5) recentForms.push(isWin ? "W" : "L");
  }
  const games = wins + losses;
  const winRate = pct(wins, games);

  const gameSessionIds = new Set(
    myMatches.map((m) => m.session_id).filter((sid): sid is string => !!sid && completedIds.has(sid))
  );
  const gameSessionCount = gameSessionIds.size;
  const participationRate = pct(gameSessionCount, completedCount);
  const absenceCount = completedCount - gameSessionCount;
  const absenceRate = participationRate === null ? null : 100 - participationRate;

  // ── 출석 ────────────────────────────────────────────────────
  const attendMap = new Map((attendanceRows ?? []).map((r) => [r.session_id, r.status]));
  let attending = 0, absent = 0, undecided = 0;
  for (const [sid, status] of attendMap) {
    if (!completedIds.has(sid)) continue;
    if (status === "attending") attending++;
    else if (status === "absent") absent++;
    else undecided++;
  }
  const attendRate = pct(attending, completedCount);

  // ── 세션별 참여자 집합 ────────────────────────────────────────
  const participantsPerSession = new Map<string, Set<string>>();
  for (const m of allMatches ?? []) {
    if (!m.session_id) continue;
    if (!participantsPerSession.has(m.session_id)) participantsPerSession.set(m.session_id, new Set());
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
      .filter(Boolean).forEach((id) => participantsPerSession.get(m.session_id)!.add(id!));
  }

  const noShowSessionIds: string[] = [];
  for (const [sid, status] of attendMap) {
    if (!completedIds.has(sid)) continue;
    if (status === "attending" && !participantsPerSession.get(sid)?.has(memberId)) {
      noShowSessionIds.push(sid);
    }
  }
  const noShowCount = noShowSessionIds.length;

  const sessionMap = new Map((allSessions ?? []).map((s) => [s.id, s]));
  const memberNameMap = new Map((allMembers ?? []).map((m) => [m.id, m.name]));

  const recentMatchItems = myMatches.slice(0, 10).map((m) => {
    const isTeamA = [m.team_a_player1_member, m.team_a_player2_member].includes(memberId);
    const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
    const session = m.session_id ? sessionMap.get(m.session_id) : null;
    const partnerId = isTeamA
      ? [m.team_a_player1_member, m.team_a_player2_member].find((id) => id && id !== memberId)
      : [m.team_b_player1_member, m.team_b_player2_member].find((id) => id && id !== memberId);
    const opponentIds = isTeamA
      ? [m.team_b_player1_member, m.team_b_player2_member].filter(Boolean)
      : [m.team_a_player1_member, m.team_a_player2_member].filter(Boolean);
    return { m, isTeamA, isWin, session,
      partnerName: partnerId ? (memberNameMap.get(partnerId) ?? "알수없음") : null,
      opponentNames: opponentIds.map((id) => memberNameMap.get(id!) ?? "알수없음"),
    };
  });

  const memberTypeLabel: Record<string, string> = { 정회원: "정회원", 준회원: "준회원", 게스트: "게스트" };

  const noShowSessions = noShowSessionIds.map((sid) => sessionMap.get(sid)).filter(Boolean);

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };
  const divStyle  = { borderColor: "var(--admin-border)" };

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title={member.name}
        description={memberTypeLabel[member.member_type] ?? member.member_type}
        backHref="/admin/records/players"
      />

      {/* ── 시즌 요약 카드 */}
      {completedCount > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>시즌 요약</p>
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
            <div className="grid grid-cols-3 divide-x divide-[color:var(--admin-border)] border-b" style={divStyle}>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{completedCount}</p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>완료 매치</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{gameSessionCount}</p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>참여 매치</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums" style={{ color: absenceCount > 0 ? "#d4783c" : "var(--admin-muted)" }}>{absenceCount}</p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>미참여 매치</p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[color:var(--admin-border)]">
              <div className="px-4 py-3 text-center">
                <p className="font-score text-xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{fmtPct(participationRate)}</p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>경기 참여율</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{fmtPct(attendRate)}</p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>출석 체크율</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-xl font-bold tabular-nums" style={{ color: noShowCount > 0 ? "#d4783c" : "var(--admin-muted)" }}>
                  {noShowCount > 0 ? `${noShowCount}회` : "없음"}
                </p>
                <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>출석 후 미참여</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Summary Cards */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
          <div className="grid grid-cols-2 divide-x divide-y divide-[color:var(--admin-border)]">
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{games}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>총 경기</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{wins}승 {losses}패</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{fmtPct(winRate)}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>승률</p>
              {games === 0 && <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>경기 기록 없음</p>}
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{fmtPct(attendRate)}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>출석 체크율</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                {completedCount > 0 ? `완료 ${completedCount}매치 중 ${attending}회` : "완료 매치 없음"}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{member.league_point}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>현재 LP</p>
            </div>
            <div className="px-5 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{fmtPct(participationRate)}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>경기 참여율</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                {completedCount > 0 ? `완료 ${completedCount}매치 중 ${gameSessionCount}회` : "완료 매치 없음"}
              </p>
            </div>
            {(absenceRate ?? 0) > 0 && (
              <div className="px-5 py-4">
                <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "#d4783c" }}>{fmtPct(absenceRate)}</p>
                <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>미참여도</p>
                <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{absenceCount}회 / 완료 {completedCount}매치</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 최근 폼 */}
      {recentForms.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>최근 폼</p>
          <div className="flex items-center gap-2">
            {recentForms.map((f, i) => (
              <span key={i} className="font-score rounded-sm px-2.5 py-1 text-sm font-bold"
                style={f === "W"
                  ? { background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
                  : { background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" }}>
                {f}
              </span>
            ))}
            <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>최근 {recentForms.length}경기</span>
          </div>
        </section>
      )}

      {/* ── LP 히스토리 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>LP 히스토리</p>
        {!(pointHistory ?? []).length ? (
          <div className="rounded-[var(--admin-card-radius,14px)] border p-4 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>LP 히스토리 없음</p>
            <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>경기 결과 입력 후 LP가 집계되면 표시됩니다.</p>
          </div>
        ) : (() => {
          const pts = pointHistory ?? [];
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
            <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
              <div className="px-4 pt-3">
                <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--admin-muted)" }}>
                  <span className="font-score">{minV} LP</span>
                  <span className="font-score font-bold" style={{ color: "var(--admin-achievement)" }}>{maxV} LP</span>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-1 block">
                  <path d={pathD} fill="none" stroke="#B9A64B" strokeWidth="1.5" strokeLinejoin="round" />
                  {pts.length > 1 && <circle cx={lastX} cy={lastY} r="3" fill="#B9A64B" />}
                </svg>
              </div>
              <div className="border-t px-4 pb-3 pt-2" style={divStyle}>
                <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{pts[0]?.created_at.slice(0, 10)} – {pts[pts.length - 1]?.created_at.slice(0, 10)}</p>
              </div>
              <div className="border-t" style={divStyle}>
                {[...pts].reverse().slice(0, 5).map((ph, idx, arr) => (
                  <div key={ph.id}
                    className={`flex items-center justify-between px-4 py-2 ${idx < arr.length - 1 ? "border-b" : ""}`}
                    style={{ borderColor: "var(--admin-border)" }}>
                    <div>
                      <p className="text-xs" style={{ color: "var(--admin-text)" }}>{ph.reason}</p>
                      <p className="text-[9px]" style={{ color: "var(--admin-muted)" }}>{ph.created_at.slice(0, 10)}</p>
                    </div>
                    <p className="font-score text-sm font-bold tabular-nums"
                      style={{ color: ph.point_change >= 0 ? "var(--admin-achievement)" : "#d4783c" }}>
                      {ph.point_change >= 0 ? "+" : ""}{ph.point_change}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── 출석 후 미참여 상세 */}
      {noShowCount > 0 && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            출석 후 미참여 상세
          </p>
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={{ borderColor: "rgba(212,120,60,0.3)", background: "var(--admin-surface)" }}>
            <div className="border-b px-4 py-2.5" style={{ borderColor: "rgba(212,120,60,0.2)" }}>
              <p className="text-xs font-semibold" style={{ color: "#d4783c" }}>
                출석 체크 후 경기 기록이 없는 매치 {noShowCount}회
              </p>
              <p className="text-[9px]" style={{ color: "var(--admin-muted)" }}>부상·대기·운영 참여 등이 포함될 수 있습니다.</p>
            </div>
            {noShowSessions.map((s, idx) => s && (
              <div key={s.id}
                className={`flex items-center justify-between px-4 py-2.5 ${idx < noShowSessions.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "var(--admin-border)" }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--admin-text)" }}>{matchTitle(s)}</p>
                  <p className="font-score text-[10px] tabular-nums" style={{ color: "var(--admin-muted)" }}>{s.session_date}</p>
                </div>
                <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={{ borderColor: "rgba(212,120,60,0.3)", background: "rgba(212,120,60,0.1)", color: "#d4783c" }}>
                  출석 후 미참여
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 최근 경기 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>최근 경기</p>
        {recentMatchItems.length === 0 ? (
          <div className="rounded-[var(--admin-card-radius,14px)] border p-4 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
            {recentMatchItems.map(({ m, isTeamA, isWin, session, partnerName, opponentNames }, idx) => (
              <div key={m.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx < recentMatchItems.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-score rounded-sm px-2 py-0.5 text-[11px] font-bold"
                  style={isWin
                    ? { background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
                    : { background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" }}>
                  {isWin ? "W" : "L"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--admin-text)" }}>
                    {session ? matchTitle(session) : m.played_at}
                  </p>
                  <p className="font-score text-[10px] tabular-nums" style={{ color: "var(--admin-muted)" }}>
                    {isTeamA ? "청팀" : "우팀"} · {m.score_a}:{m.score_b}
                  </p>
                  {(partnerName || opponentNames.length > 0) && (
                    <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
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

      {/* ── 출석 기록 */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>출석 기록</p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
          <div className="grid grid-cols-4 divide-x divide-[color:var(--admin-border)]">
            {[
              { label: "출석",  value: attending,                                   color: "var(--admin-achievement)" },
              { label: "미정",  value: undecided,                                   color: "#d4783c" },
              { label: "불참",  value: absent,                                      color: "var(--admin-muted)" },
              { label: "미출석", value: completedCount - attending - absent - undecided, color: "var(--admin-muted)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-3 text-center">
                <p className="font-score text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
                <p className="mt-0.5 text-[9px]" style={{ color: "var(--admin-muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
