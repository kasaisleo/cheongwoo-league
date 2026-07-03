import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";

export default async function GuestRecordPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const guestId = params.id;

  const [{ data: guest }, { data: allMatches }, { data: allSessions }, { data: allMembers }] = await Promise.all([
    supabase.from("guests").select("id, name").eq("id", guestId).maybeSingle(),
    supabase.from("matches").select("*").order("played_at", { ascending: false }),
    supabase.from("attendance_sessions").select("id, title, session_day"),
    supabase.from("members").select("id, name").eq("is_active", true),
  ]);

  if (!guest) {
    return (
      <main className="px-4 pt-6">
        <p className="text-sm text-line-400">게스트를 찾을 수 없어요.</p>
        <Link href="/admin/records/players" className="mt-2 block text-xs text-clay-400">← 선수 기록 분석</Link>
      </main>
    );
  }

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

  return (
    <main className="px-4 pt-6 pb-28">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">{guest.name}</h1>
          <span className="mt-1 inline-block rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">게스트</span>
        </div>
        <Link href="/admin/records/players"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 선수 기록 분석
        </Link>
      </header>

      {/* Summary */}
      <section className="mb-5">
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-3 divide-x divide-line-200/30">
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{games}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">총 경기</p>
            </div>
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-gold">{winRate}%</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">승률</p>
              <p className="text-[10px] text-line-400">{wins}승 {losses}패</p>
            </div>
            <div className="px-4 py-4">
              <p className="font-score text-4xl font-bold tabular-nums text-line-900">{myMatches.length}</p>
              <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">매치</p>
            </div>
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
          </div>
        </section>
      )}

      {/* LP 안내 */}
      <section className="mb-5">
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">LP</p>
          <p className="mt-1 text-sm text-line-400">게스트는 LP 기록이 없습니다.</p>
        </div>
      </section>

      {/* 최근 경기 */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">경기 기록</p>
        {myMatches.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-4 text-center">
            <p className="text-sm text-line-400">경기 기록이 없어요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
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
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${idx < Math.min(myMatches.length, 10) - 1 ? "border-b border-line-200/30" : ""}`}>
                  <span className={`font-score rounded-sm px-2 py-0.5 text-[11px] font-bold ${isWin ? "bg-gold/10 text-gold" : "bg-line-200/40 text-line-500"}`}>{isWin ? "W" : "L"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-line-900">
                      {session ? (MATCH_SESSION_DAY_LABEL[session.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? session.title) : m.played_at}
                    </p>
                    <p className="font-score text-[10px] tabular-nums text-line-400">
                      {isTeamA ? "청팀" : "우팀"} · {m.score_a}:{m.score_b}
                    </p>
                    {(partnerMemberId || opponentIds.length > 0) && (
                      <p className="text-[10px] text-line-400">
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
