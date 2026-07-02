"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MemberType } from "@/lib/supabase/database.types";

// ── 타입 ────────────────────────────────────────────────────────
interface PlayerRecord {
  id: string;
  name: string;
  isGuest: boolean;
  memberType: MemberType | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  lp: number | null;        // 회원이면 league_point, 게스트는 null
  attending: number;        // 출석 수 (회원만)
  noShowCount: number;      // 출석 후 경기 미참여 수
  totalCompleted: number;   // 완료된 매치 수 (출석률 분모)
  attendRate: number;       // 출석률 % (회원만)
  noShowRate: number;       // 출석 후 경기 미참여율 %
}

// ── MemberTypeBadge ──────────────────────────────────────────────
function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">게스트</span>
  );
  if (memberType === "준회원") return (
    <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">준회원</span>
  );
  return null;
}

// ── TOP 5 섹션 ───────────────────────────────────────────────────
function Top5Card({ title, players, valueKey, valueSuffix, href }: {
  title: string;
  players: (PlayerRecord & { displayValue: string })[];
  valueKey: string;
  valueSuffix: string;
  href: (p: PlayerRecord) => string;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="border-b border-line-200/30 px-4 py-2.5">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">{title}</p>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-3 text-sm text-line-400">기록 없음</p>
      ) : players.map((p, idx) => (
        <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={href(p)}>
          <div className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < players.length - 1 ? "border-b border-line-200/20" : ""}`}>
            <span className={`w-4 flex-shrink-0 text-right font-score text-[12px] font-bold tabular-nums ${idx === 0 ? "text-gold" : "text-line-400"}`}>
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-line-900">{p.name}</span>
                <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
              </div>
            </div>
            <span className="font-score text-sm font-bold tabular-nums text-line-700">{p.displayValue}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function PlayerRecordsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      const [
        { data: sessions },
        { data: matches },
        { data: attendanceRows },
        { data: members },
        { data: guests },
      ] = await Promise.all([
        supabase.from("attendance_sessions").select("id, session_date, status").neq("status", "archived"),
        supabase.from("matches").select("*"),
        supabase.from("attendance").select("session_id, member_id, status"),
        supabase.from("members").select("id, name, member_type, league_point").eq("is_active", true),
        supabase.from("guests").select("id, name").eq("is_active", true).is("converted_to_member_id", null),
      ]);

      const completedIds = new Set(
        (sessions ?? []).filter((s) => s.status === "closed" || s.session_date < today).map((s) => s.id)
      );

      // 세션별 경기 참여자 집합
      const participantsPerSession = new Map<string, Set<string>>();
      for (const m of matches ?? []) {
        if (!m.session_id) continue;
        if (!participantsPerSession.has(m.session_id)) participantsPerSession.set(m.session_id, new Set());
        const s = participantsPerSession.get(m.session_id)!;
        [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
          .filter(Boolean).forEach((id) => s.add("M:" + id));
        [m.team_a_player1_guest, m.team_a_player2_guest, m.team_b_player1_guest, m.team_b_player2_guest]
          .filter(Boolean).forEach((id) => s.add("G:" + id));
      }

      // 경기 기록 집계 (회원 + 게스트)
      const statMap = new Map<string, PlayerRecord>();
      function ensureMember(id: string) {
        const key = "M:" + id;
        if (!statMap.has(key)) {
          const m = (members ?? []).find((m) => m.id === id);
          statMap.set(key, { id, name: m?.name ?? "알수없음", isGuest: false, memberType: m?.member_type as MemberType ?? null, games: 0, wins: 0, losses: 0, winRate: 0, lp: m?.league_point ?? null, attending: 0, noShowCount: 0, totalCompleted: 0, attendRate: 0, noShowRate: 0 });
        }
        return statMap.get(key)!;
      }
      function ensureGuest(id: string) {
        const key = "G:" + id;
        if (!statMap.has(key)) {
          const g = (guests ?? []).find((g) => g.id === id);
          statMap.set(key, { id, name: g?.name ?? "게스트", isGuest: true, memberType: null, games: 0, wins: 0, losses: 0, winRate: 0, lp: null, attending: 0, noShowCount: 0, totalCompleted: 0, attendRate: 0, noShowRate: 0 });
        }
        return statMap.get(key)!;
      }

      for (const m of matches ?? []) {
        const aWin = m.winner_team === "A";
        const slots: [string | null, boolean, boolean][] = [
          [m.team_a_player1_member, false, aWin],
          [m.team_a_player2_member, false, aWin],
          [m.team_b_player1_member, false, !aWin],
          [m.team_b_player2_member, false, !aWin],
          [m.team_a_player1_guest, true, aWin],
          [m.team_a_player2_guest, true, aWin],
          [m.team_b_player1_guest, true, !aWin],
          [m.team_b_player2_guest, true, !aWin],
        ];
        for (const [id, isGuest, isWin] of slots) {
          if (!id) continue;
          const p = isGuest ? ensureGuest(id) : ensureMember(id);
          p.games++; if (isWin) p.wins++; else p.losses++;
        }
      }

      // 출석 집계 (회원만) + 노쇼
      const totalCompleted = completedIds.size;
      for (const row of attendanceRows ?? []) {
        if (!completedIds.has(row.session_id)) continue;
        const p = statMap.get("M:" + row.member_id);
        if (!p) { const p2 = ensureMember(row.member_id); p2.totalCompleted = totalCompleted; statMap.set("M:" + row.member_id, p2); statMap.get("M:" + row.member_id)!.totalCompleted = totalCompleted; }
        const rec = statMap.get("M:" + row.member_id)!;
        rec.totalCompleted = totalCompleted;
        if (row.status === "attending") {
          rec.attending++;
          const inGame = participantsPerSession.get(row.session_id)?.has("M:" + row.member_id);
          if (!inGame) rec.noShowCount++;
        }
      }

      // 비율 계산
      for (const p of statMap.values()) {
        p.winRate   = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
        p.attendRate  = p.totalCompleted > 0 ? Math.round((p.attending / p.totalCompleted) * 100) : 0;
        p.noShowRate  = p.attending > 0 ? Math.round((p.noShowCount / p.attending) * 100) : 0;
      }

      setPlayers([...statMap.values()]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    if (!query.trim()) return players;
    const q = query.trim().toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  // TOP 5 파생
  const top5Participation = [...players].sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5WinRate = [...players].filter((p) => p.games >= 1).sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5Attend = [...players].filter((p) => !p.isGuest && p.totalCompleted > 0).sort((a, b) => b.attendRate - a.attendRate || b.attending - a.attending || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5NoShow = [...players].filter((p) => !p.isGuest && p.attending >= 1).sort((a, b) => b.noShowRate - a.noShowRate || b.noShowCount - a.noShowCount || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5LP = [...players].filter((p) => !p.isGuest && p.lp !== null).sort((a, b) => (b.lp ?? 0) - (a.lp ?? 0)).slice(0, 5);

  const playerHref = (p: PlayerRecord) => p.isGuest ? `/admin/records/players/guest/${p.id}` : `/admin/records/players/member/${p.id}`;

  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Player Records</p>
          <h1 className="headline-kr text-4xl text-line-900">개인별 기록</h1>
        </div>
        <Link href="/admin/records"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 기록 대시보드
        </Link>
      </header>

      {/* 검색 */}
      <div className="mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색 (회원 + 게스트)"
          className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>

      {/* 검색 결과 */}
      {query.trim() && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            검색 결과
          </p>
          {filtered.length === 0 ? (
            <p className="text-sm text-line-400">검색 결과가 없어요.</p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              {filtered.slice(0, 15).map((p, idx) => (
                <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={playerHref(p)}>
                  <div className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${idx < Math.min(filtered.length, 15) - 1 ? "border-b border-line-200/30" : ""}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="text-[15px] font-semibold leading-snug text-line-900">{p.name}</span>
                      <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                    </div>
                    <span className="text-xs text-line-400">{p.games}경기 · {p.winRate}%</span>
                    <span className="text-xs text-line-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : (
        <>
          {/* TOP 5 그리드 */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Top 5 Boards
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Top5Card title="참여도 TOP 5" players={top5Participation.map((p) => ({ ...p, displayValue: `${p.games}경기` }))} valueKey="games" valueSuffix="경기" href={playerHref} />
              <Top5Card title="승률 TOP 5" players={top5WinRate.map((p) => ({ ...p, displayValue: `${p.winRate}%` }))} valueKey="winRate" valueSuffix="%" href={playerHref} />
              <Top5Card title="출석률 TOP 5" players={top5Attend.map((p) => ({ ...p, displayValue: `${p.attendRate}%` }))} valueKey="attendRate" valueSuffix="%" href={playerHref} />
              <Top5Card title="LP TOP 5" players={top5LP.map((p) => ({ ...p, displayValue: `${p.lp}LP` }))} valueKey="lp" valueSuffix="LP" href={playerHref} />
            </div>
          </section>

          {/* 출석 후 경기 미참여 */}
          <section className="mb-5">
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/30 px-4 py-2.5">
                <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">출석 후 경기 미참여</p>
                <p className="text-[9px] text-line-400">출석 체크 후 경기 기록이 없는 매치 비율</p>
              </div>
              {top5NoShow.map((p, idx) => (
                <Link key={"M:" + p.id} href={playerHref(p)}>
                  <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < top5NoShow.length - 1 ? "border-b border-line-200/20" : ""}`}>
                    <span className="w-4 flex-shrink-0 text-right font-score text-[12px] font-bold tabular-nums text-line-400">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-line-900">{p.name}</span>
                        <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                      </div>
                      <p className="text-[10px] text-line-400">출석 {p.attending}회 중 {p.noShowCount}회</p>
                    </div>
                    <span className="font-score text-sm font-bold tabular-nums text-clay-400">{p.noShowRate}%</span>
                  </div>
                </Link>
              ))}
              {top5NoShow.length === 0 && <p className="px-4 py-3 text-sm text-line-400">기록 없음</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
