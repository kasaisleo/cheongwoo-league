import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { getAdminAccessServer } from "@/lib/admin-permissions";

export default async function GuestRecordPage({ params }: { params: { id: string } }) {
  // members_select_all 삭제 이후에도 끊기지 않도록, guests/matches도 anon-key ACL이
  // 없으므로(guests P0 / matches P0) 전부 service-role로 조회한다.
  const supabaseAdmin = createServiceClient();
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";
  const guestId = params.id;

  const [{ data: guest }, { data: allMatches }, { data: allSessions }, { data: allMembers }] = await Promise.all([
    supabaseAdmin.from("guests").select("id, name").eq("id", guestId).eq("club_id", currentClubId).maybeSingle(),
    supabaseAdmin
      .from("matches")
      .select("id, played_at, session_id, score_a, score_b, winner_team, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member, team_a_player1_guest, team_a_player2_guest, team_b_player1_guest, team_b_player2_guest")
      .eq("club_id", currentClubId)
      .order("played_at", { ascending: false }),
    // attendance_sessions Admin read도 anon-role RLS가 아니라 service-role + club_id로 강제한다.
    supabaseAdmin.from("attendance_sessions").select("id, title, session_day").eq("club_id", currentClubId),
    supabaseAdmin.from("members").select("id, name").eq("is_active", true).eq("club_id", currentClubId),
  ]);

  if (!guest) notFound();

  const myMatches = (allMatches ?? []).filter((m) => {
    const guestSlots = [m.team_a_player1_guest, m.team_a_player2_guest, m.team_b_player1_guest, m.team_b_player2_guest];
    return guestSlots.includes(guestId);
  });

  let wins = 0, losses = 0;
  const recentForms: string[] = [];
  for (const m of myMatches) {
    const isTeamA = [m.team_a_player1_guest, m.team_a_player2_guest].includes(guestId);
    const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
    if (isWin) wins++; else losses++;
    if (recentForms.length < 5) recentForms.push(isWin ? "W" : "L");
  }
  const games = wins + losses;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

  const sessionMap    = new Map((allSessions ?? []).map((s) => [s.id, s]));
  const memberNameMap = new Map((allMembers ?? []).map((m) => [m.id, m.name]));

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };
  const divStyle  = { borderColor: "var(--admin-border)" };

  const guestBadge = (
    <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" }}>
      게스트
    </span>
  );

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title={guest.name}
        backHref="/admin/records/players"
        action={guestBadge}
      />

      {/* Summary */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
          <div className="grid grid-cols-3 divide-x divide-[color:var(--admin-border)]">
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{games}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>총 경기</p>
            </div>
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{winRate}%</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>승률</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{wins}승 {losses}패</p>
            </div>
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{myMatches.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>매치</p>
            </div>
          </div>
        </div>
      </section>

      {/* 최근 폼 */}
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
          </div>
        </section>
      )}

      {/* LP 안내 */}
      <section className="mb-5">
        <div className="rounded-[var(--admin-card-radius,14px)] border px-4 py-3" style={cardStyle}>
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>LP</p>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>게스트는 LP 기록이 없습니다.</p>
        </div>
      </section>

      {/* 최근 경기 */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>경기 기록</p>
        {myMatches.length === 0 ? (
          <div className="rounded-[var(--admin-card-radius,14px)] border p-4 text-center" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--admin-muted)" }}>경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
            {myMatches.slice(0, 10).map((m, idx) => {
              const isTeamA = [m.team_a_player1_guest, m.team_a_player2_guest].includes(guestId);
              const isWin = (isTeamA && m.winner_team === "A") || (!isTeamA && m.winner_team === "B");
              const session = m.session_id ? sessionMap.get(m.session_id) : null;
              const partnerMemberId = isTeamA
                ? [m.team_a_player1_member, m.team_a_player2_member].find(Boolean)
                : [m.team_b_player1_member, m.team_b_player2_member].find(Boolean);
              const opponentIds = isTeamA
                ? [m.team_b_player1_member, m.team_b_player2_member].filter(Boolean)
                : [m.team_a_player1_member, m.team_a_player2_member].filter(Boolean);
              return (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${idx < Math.min(myMatches.length, 10) - 1 ? "border-b" : ""}`} style={divStyle}>
                  <span className="font-score rounded-sm px-2 py-0.5 text-[11px] font-bold"
                    style={isWin
                      ? { background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
                      : { background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" }}>
                    {isWin ? "W" : "L"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--admin-text)" }}>
                      {session ? (MATCH_SESSION_DAY_LABEL[session.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? session.title) : m.played_at}
                    </p>
                    <p className="font-score text-[10px] tabular-nums" style={{ color: "var(--admin-muted)" }}>
                      {isTeamA ? "청팀" : "우팀"} · {m.score_a}:{m.score_b}
                    </p>
                    {(partnerMemberId || opponentIds.length > 0) && (
                      <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                        {partnerMemberId && `파트너: ${memberNameMap.get(partnerMemberId) ?? "알수없음"}`}
                        {partnerMemberId && opponentIds.length > 0 && " · "}
                        {opponentIds.length > 0 && `상대: ${opponentIds.map((id) => memberNameMap.get(id!) ?? "알수없음").join(", ")}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
