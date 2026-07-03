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
  games: number;         // 총 경기 수
  wins: number;
  losses: number;
  winRate: number;       // 승률 %
  lp: number | null;
  attending: number;     // 출석 수
  noShowCount: number;   // 출석 후 경기 미참여 수
  totalCompleted: number; // 완료 매치 수
  attendRate: number;    // 출석 체크율 %
  noShowRate: number;    // 출석 후 미참여율 %
  gameSessionCount: number; // 실제 경기 참여한 session 수
  participationRate: number; // 경기 참여율 % = gameSessionCount / totalCompleted
  absenceRate: number;   // 미참여도 % = 100 - participationRate
}

// ── MemberTypeBadge ──────────────────────────────────────────────
function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) return <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">게스트</span>;
  if (memberType === "준회원") return <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">준회원</span>;
  return null;
}

// ── RankingBoard ──────────────────────────────────────────────────
function RankingBoard({ title, unit, players, href }: {
  title: string; unit: string;
  players: (PlayerRecord & { displayValue: string })[];
  href: (p: PlayerRecord) => string;
}) {
  if (!players.length) return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="border-b border-line-200/30 px-4 py-2"><p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">{title}</p></div>
      <p className="px-4 py-3 text-sm text-line-400">기록 없음</p>
    </div>
  );
  const [first, ...rest] = players;
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="border-b border-line-200/30 px-4 py-2">
        <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">{title}</p>
      </div>
      <Link href={href(first)}>
        <div className="flex items-center gap-3 border-b border-line-200/30 px-4 py-3 transition-colors hover:bg-line-100/40">
          <span className="font-score w-5 flex-shrink-0 text-right text-lg font-bold tabular-nums text-gold">1</span>
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span className="text-[15px] font-semibold leading-snug text-line-900">{first.name}</span>
            <MemberTypeBadge isGuest={first.isGuest} memberType={first.memberType} />
          </div>
          <span className="font-score text-xl font-bold tabular-nums text-gold">{first.displayValue}<span className="ml-0.5 text-[10px] text-gold/60">{unit}</span></span>
        </div>
      </Link>
      {rest.map((p, i) => (
        <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={href(p)}>
          <div className={`flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-line-100/40 ${i < rest.length - 1 ? "border-b border-line-200/20" : ""}`}>
            <span className={`font-score w-5 flex-shrink-0 text-right text-[12px] font-bold tabular-nums ${i === 0 ? "text-line-600" : "text-line-400"}`}>{i + 2}</span>
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-line-800">{p.name}</span>
              <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
            </div>
            <span className="font-score text-sm font-bold tabular-nums text-line-700">{p.displayValue}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── SortableSignalBoard — 정렬 토글 포함 ──────────────────────────
function SortableSignalBoard({ title, desc, emptyMsg, playersDesc, playersAsc, href }: {
  title: string; desc: string; emptyMsg?: string;
  playersDesc: (PlayerRecord & { displayValue: string; subText?: string })[];
  playersAsc:  (PlayerRecord & { displayValue: string; subText?: string })[];
  href: (p: PlayerRecord) => string;
}) {
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const players = order === "desc" ? playersDesc : playersAsc;
  const allZero = order === "desc" && players.every((p) => p.displayValue.startsWith("0/") || p.displayValue === "0%");
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2">
        <div>
          <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">{title}</p>
          <p className="text-[9px] text-line-400">{desc}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setOrder("desc")}
            className={`rounded-sm px-2 py-0.5 text-[9px] font-semibold ${order === "desc" ? "bg-line-200 text-line-700" : "text-line-400 hover:text-line-600"}`}>
            높은 순
          </button>
          <button type="button" onClick={() => setOrder("asc")}
            className={`rounded-sm px-2 py-0.5 text-[9px] font-semibold ${order === "asc" ? "bg-line-200 text-line-700" : "text-line-400 hover:text-line-600"}`}>
            낮은 순
          </button>
        </div>
      </div>
      {!players.length ? (
        <p className="px-4 py-3 text-sm text-line-400">기록 없음</p>
      ) : allZero && emptyMsg ? (
        <div className="px-4 py-4">
          <p className="text-sm font-semibold text-line-700">{emptyMsg}</p>
          <p className="mt-1 text-[11px] text-line-400">{desc}</p>
        </div>
      ) : players.map((p, idx) => (
        <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={href(p)}>
          <div className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < players.length - 1 ? "border-b border-line-200/20" : ""}`}>
            <span className={`font-score w-5 flex-shrink-0 text-right text-[12px] font-bold tabular-nums ${idx === 0 && order === "desc" ? "text-clay-400" : "text-line-400"}`}>{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-line-900">{p.name}</span>
                <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
              </div>
              {p.subText && <p className="text-[9px] text-line-400">{p.subText}</p>}
            </div>
            <span className={`font-score text-sm font-bold tabular-nums ${idx === 0 && order === "desc" ? "text-clay-400" : "text-line-500"}`}>{p.displayValue}</span>
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
  const [showDirectory, setShowDirectory] = useState(false);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const [
        { data: sessions }, { data: matches },
        { data: attendanceRows }, { data: members }, { data: guests },
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
      const totalCompleted = completedIds.size;

      // 세션별 실제 경기 참여자
      const participantsPerSession = new Map<string, Set<string>>();
      for (const m of matches ?? []) {
        if (!m.session_id) continue;
        if (!participantsPerSession.has(m.session_id)) participantsPerSession.set(m.session_id, new Set());
        const s = participantsPerSession.get(m.session_id)!;
        [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member].filter(Boolean).forEach((id) => s.add("M:" + id));
        [m.team_a_player1_guest, m.team_a_player2_guest, m.team_b_player1_guest, m.team_b_player2_guest].filter(Boolean).forEach((id) => s.add("G:" + id));
      }

      // 개인별 경기 참여 session 집합
      const gameSessionsPerPlayer = new Map<string, Set<string>>();
      for (const [sid, participants] of participantsPerSession) {
        if (!completedIds.has(sid)) continue;
        for (const key of participants) {
          if (!gameSessionsPerPlayer.has(key)) gameSessionsPerPlayer.set(key, new Set());
          gameSessionsPerPlayer.get(key)!.add(sid);
        }
      }

      const statMap = new Map<string, PlayerRecord>();
      const mk = (id: string, isGuest: boolean): PlayerRecord => isGuest
        ? { id, name: (guests ?? []).find((g) => g.id === id)?.name ?? "게스트", isGuest: true, memberType: null, games: 0, wins: 0, losses: 0, winRate: 0, lp: null, attending: 0, noShowCount: 0, totalCompleted: 0, attendRate: 0, noShowRate: 0, gameSessionCount: 0, participationRate: 0, absenceRate: 0 }
        : { id, name: (members ?? []).find((m) => m.id === id)?.name ?? "알수없음", isGuest: false, memberType: ((members ?? []).find((m) => m.id === id)?.member_type as MemberType) ?? null, games: 0, wins: 0, losses: 0, winRate: 0, lp: (members ?? []).find((m) => m.id === id)?.league_point ?? null, attending: 0, noShowCount: 0, totalCompleted, attendRate: 0, noShowRate: 0, gameSessionCount: 0, participationRate: 0, absenceRate: 0 };

      function ensure(id: string, isGuest: boolean) {
        const key = (isGuest ? "G:" : "M:") + id;
        if (!statMap.has(key)) statMap.set(key, mk(id, isGuest));
        return statMap.get(key)!;
      }

      for (const m of matches ?? []) {
        const aWin = m.winner_team === "A";
        const slots: [string | null, boolean, boolean][] = [
          [m.team_a_player1_member, false, aWin], [m.team_a_player2_member, false, aWin],
          [m.team_b_player1_member, false, !aWin], [m.team_b_player2_member, false, !aWin],
          [m.team_a_player1_guest, true, aWin], [m.team_a_player2_guest, true, aWin],
          [m.team_b_player1_guest, true, !aWin], [m.team_b_player2_guest, true, !aWin],
        ];
        for (const [id, isGuest, isWin] of slots) {
          if (!id) continue;
          const p = ensure(id, isGuest);
          p.games++; if (isWin) p.wins++; else p.losses++;
        }
      }

      // 출석 집계 + 미참여 (회원만)
      for (const row of attendanceRows ?? []) {
        if (!completedIds.has(row.session_id)) continue;
        const rec = ensure(row.member_id, false);
        if (row.status === "attending") {
          rec.attending++;
          const inGame = participantsPerSession.get(row.session_id)?.has("M:" + row.member_id);
          if (!inGame) rec.noShowCount++;
        }
      }

      // 비율 계산
      for (const [key, p] of statMap) {
        p.winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
        // 출석 체크율 (개인 기준): 출석 체크 수 / 완료 매치 수
        p.attendRate = p.totalCompleted > 0 ? Math.round((p.attending / p.totalCompleted) * 100) : 0;
        p.noShowRate = p.attending > 0 ? Math.round((p.noShowCount / p.attending) * 100) : 0;
        const gameSessions = gameSessionsPerPlayer.get(key)?.size ?? 0;
        p.gameSessionCount = gameSessions;
        p.participationRate = p.totalCompleted > 0 ? Math.round((gameSessions / p.totalCompleted) * 100) : 0;
        p.absenceRate = p.totalCompleted > 0 ? 100 - p.participationRate : 0;
      }

      setPlayers([...statMap.values()]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  // TOP 5
  const top5Participation = [...players].sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.wins - a.wins || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5WinRate      = [...players].filter((p) => p.games >= 1).sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5Attend       = [...players].filter((p) => !p.isGuest && p.totalCompleted > 0).sort((a, b) => b.attendRate - a.attendRate || b.attending - a.attending || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5LP           = [...players].filter((p) => !p.isGuest && p.lp !== null).sort((a, b) => (b.lp ?? 0) - (a.lp ?? 0)).slice(0, 5);
  // Management Signals — 높은 순 / 낮은 순
  const absenceBase = [...players].filter((p) => !p.isGuest && p.totalCompleted > 0);
  const top5AbsenceDesc = absenceBase.sort((a, b) => b.absenceRate - a.absenceRate || (b.totalCompleted - b.gameSessionCount) - (a.totalCompleted - a.gameSessionCount) || b.totalCompleted - a.totalCompleted || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5AbsenceAsc  = [...absenceBase].sort((a, b) => a.absenceRate - b.absenceRate || b.gameSessionCount - a.gameSessionCount || b.totalCompleted - a.totalCompleted || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const noShowBase = [...players].filter((p) => !p.isGuest && p.attending >= 1);
  const top5NoShowDesc = noShowBase.sort((a, b) => b.noShowRate - a.noShowRate || b.noShowCount - a.noShowCount || b.attending - a.attending || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5NoShowAsc  = [...noShowBase].sort((a, b) => a.noShowRate - b.noShowRate || b.attending - a.attending || a.noShowCount - b.noShowCount || a.name.localeCompare(b.name, "ko")).slice(0, 5);

  const playerHref = (p: PlayerRecord) => p.isGuest ? `/admin/records/players/guest/${p.id}` : `/admin/records/players/member/${p.id}`;

  const sortedAll = [...players].sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.name.localeCompare(b.name, "ko"));

  return (
    <main className="px-4 pt-6 pb-28">
      {/* ── Header */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">선수 기록 분석</h1>
        </div>
        <Link href="/admin/records" className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 기록 대시보드
        </Link>
      </header>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : (
        <>
          {/* ── Leaders */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Leaders</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "참여도", p: top5Participation[0], val: top5Participation[0] ? `${top5Participation[0].games}` : "—", unit: "경기" },
                { label: "승률",   p: top5WinRate[0],       val: top5WinRate[0] ? `${top5WinRate[0].winRate}` : "—",         unit: "%" },
                { label: "출석 체크율", p: top5Attend[0],        val: top5Attend[0] ? `${top5Attend[0].attendRate}` : "—",        unit: "%" },
                { label: "LP",     p: top5LP[0],            val: top5LP[0] ? `${top5LP[0].lp}` : "—",                       unit: "LP" },
              ].map(({ label, p, val, unit }) => (
                <div key={label} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
                  {p ? (
                    <Link href={playerHref(p)} className="block px-4 py-3 transition-colors hover:bg-line-100/40">
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">{label}</p>
                      <p className="font-score mt-1 text-2xl font-bold tabular-nums text-gold">{val}<span className="ml-0.5 text-[10px] text-gold/60">{unit}</span></p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[13px] font-semibold text-line-900">{p.name}</span>
                        <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                      </div>
                    </Link>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">{label}</p>
                      <p className="mt-2 text-sm text-line-400">기록 없음</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Rankings */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Rankings</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RankingBoard title="참여도 TOP 5" unit="경기" players={top5Participation.map((p) => ({ ...p, displayValue: `${p.games}` }))} href={playerHref} />
              <RankingBoard title="승률 TOP 5"   unit="%" players={top5WinRate.map((p) => ({ ...p, displayValue: `${p.winRate}%` }))} href={playerHref} />
              <RankingBoard title="출석 체크율 TOP 5" unit="%" players={top5Attend.map((p) => ({ ...p, displayValue: `${p.attendRate}%` }))} href={playerHref} />
              <RankingBoard title="LP TOP 5"     unit="LP" players={top5LP.map((p) => ({ ...p, displayValue: `${p.lp}` }))} href={playerHref} />
            </div>
          </section>

          {/* ── Management Signals */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Management Signals</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SortableSignalBoard
                title="미참여도 TOP 5"
                desc="완료 매치 중 실제 경기 기록이 없는 비율"
                playersDesc={top5AbsenceDesc.map((p) => ({ ...p, displayValue: `${p.totalCompleted - p.gameSessionCount}/${p.totalCompleted} · ${p.absenceRate}%`, subText: `참여 ${p.gameSessionCount}회` }))}
                playersAsc={top5AbsenceAsc.map((p) => ({ ...p, displayValue: `${p.totalCompleted - p.gameSessionCount}/${p.totalCompleted} · ${p.absenceRate}%`, subText: `참여 ${p.gameSessionCount}회` }))}
                href={playerHref}
              />
              <SortableSignalBoard
                title="출석 후 미참여 TOP 5"
                desc="출석 체크 후 경기 기록이 없는 매치 비율"
                emptyMsg="출석 후 경기 미참여 기록이 없습니다."
                playersDesc={top5NoShowDesc.map((p) => ({ ...p, displayValue: `${p.noShowCount}/${p.attending} · ${p.noShowRate}%`, subText: `출석 ${p.attending}회` }))}
                playersAsc={top5NoShowAsc.map((p) => ({ ...p, displayValue: `${p.noShowCount}/${p.attending} · ${p.noShowRate}%`, subText: `출석 ${p.attending}회` }))}
                href={playerHref}
              />
            </div>
          </section>

          {/* ── Player Search + Directory */}
          <section>
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Player Search</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 검색 (회원 + 게스트)"
              className="mb-3 h-9 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-400"
            />

            {/* 검색 결과 */}
            {query.trim() && (
              <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
                {filtered.length === 0
                  ? <p className="px-4 py-3 text-sm text-line-400">결과 없음</p>
                  : filtered.slice(0, 15).map((p, idx) => (
                    <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={playerHref(p)}>
                      <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < Math.min(filtered.length, 15) - 1 ? "border-b border-line-200/20" : ""}`}>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="text-[15px] font-semibold leading-snug text-line-900">{p.name}</span>
                          <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                        </div>
                        <span className="font-score text-[11px] tabular-nums text-line-500">{p.games}경기 · <span className="text-gold">{p.winRate}%</span></span>
                        <span className="text-[10px] text-line-400">→</span>
                      </div>
                    </Link>
                  ))
                }
              </div>
            )}

            {/* 전체 리스트 토글 */}
            {!query.trim() && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowDirectory((v) => !v)}
                  className="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-50 px-4 py-2.5 text-left transition-colors hover:bg-line-100/40"
                >
                  <span className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                    전체 기록 리스트 ({players.length}명)
                  </span>
                  <span className="text-[10px] text-line-400">{showDirectory ? "▲ 접기" : "▼ 보기"}</span>
                </button>

                {showDirectory && (
                  <div className="mt-1 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
                    {/* 컬럼 헤더 */}
                    <div className="flex items-center gap-2 border-b border-line-200/30 px-4 py-1.5">
                      <span className="flex-1 font-display text-[8px] font-bold uppercase tracking-widest text-line-400">선수</span>
                      <span className="w-10 text-right font-display text-[8px] font-bold uppercase tracking-widest text-line-400">경기</span>
                      <span className="w-10 text-right font-display text-[8px] font-bold uppercase tracking-widest text-line-400">승률</span>
                      <span className="w-12 text-right font-display text-[8px] font-bold uppercase tracking-widest text-line-400">미참여</span>
                    </div>
                    {sortedAll.slice(0, 30).map((p, idx, arr) => (
                      <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={playerHref(p)}>
                        <div className={`flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-line-100/40 ${idx < arr.length - 1 ? "border-b border-line-200/20" : ""}`}>
                          <div className="min-w-0 flex-1 flex items-center gap-1.5">
                            <span className="text-[14px] font-semibold leading-snug text-line-900">{p.name}</span>
                            <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                          </div>
                          <span className="w-10 text-right font-score text-[12px] tabular-nums text-line-600">{p.games}</span>
                          <span className="w-10 text-right font-score text-[12px] font-bold tabular-nums text-gold">{p.winRate}%</span>
                          <span className="w-12 text-right font-score text-[12px] tabular-nums text-line-500">
                            {(!p.isGuest && p.totalCompleted > 0) ? `${p.absenceRate}%` : "—"}
                          </span>
                        </div>
                      </Link>
                    ))}
                    {players.length > 30 && (
                      <p className="border-t border-line-200/20 px-4 py-2 text-center text-[9px] text-line-400">상위 30명 · 검색으로 찾기</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
