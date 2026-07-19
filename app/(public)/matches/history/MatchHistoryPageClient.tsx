"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { MATCH_SESSION_DAY_LABEL, type SessionSummary as AttendanceSessionSummary } from "@/lib/match-session-label";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import type { MemberType } from "@/lib/supabase/database.types";

// ── 타입 ─────────────────────────────────────────────────────────
interface SessionSummary {
  session: AttendanceSessionSummary;
  matchCount: number;
}

interface PlayerRecord {
  id: string;
  name: string;
  isGuest: boolean;
  memberType: MemberType | null; // 회원이면 member_type, 게스트면 null
  wins: number;
  losses: number;
}

// ── 유틸 ─────────────────────────────────────────────────────────
function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) {
    return (
      <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
        게스트
      </span>
    );
  }
  if (memberType === "준회원") {
    return (
      <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
        준회원
      </span>
    );
  }
  // 정회원은 배지 생략 (기본값)
  return null;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function MatchHistoryPageClient({ currentClubId }: { currentClubId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = useIsAdmin();

  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);

  // ── 매치 목록 로드 ──────────────────────────────────────────────
  async function loadSummaries() {
    setLoading(true);
    const params = new URLSearchParams({ clubId: currentClubId, statuses: "closed,archived", order: "desc" });
    const sessionList = await fetch(`/api/attendance/public-sessions?${params}`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((body) => body.sessions as AttendanceSessionSummary[])
      .catch(() => {
        console.error("[MatchHistoryPageClient] public-sessions 조회 실패");
        return [] as AttendanceSessionSummary[];
      });

    const sessionIds = sessionList.map((s) => s.id);

    const { data: matchRows } = sessionIds.length > 0
      ? await supabase.from("matches").select("id, session_id").in("session_id", sessionIds)
      : { data: [] };

    setSummaries(sessionList.map((session) => ({
      session,
      matchCount: (matchRows ?? []).filter((m) => m.session_id === session.id).length,
    })));
    setLoading(false);
  }

  useEffect(() => { loadSummaries(); }, [supabase, currentClubId]);

  // ── 상세 — 참석자별 기록 ────────────────────────────────────────
  async function toggleExpand(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setPlayerRecords([]);
      return;
    }
    setExpandedSessionId(sessionId);
    setLoadingDetail(true);

    const { data: matchRows } = await supabase
      .from("matches")
      .select("*")
      .eq("session_id", sessionId);

    if (!matchRows || matchRows.length === 0) {
      setPlayerRecords([]);
      setLoadingDetail(false);
      return;
    }

    // 참여한 멤버/게스트 ID 수집
    const memberIds = new Set<string>();
    const guestIds = new Set<string>();
    for (const m of matchRows) {
      [m.team_a_player1_member, m.team_a_player2_member,
       m.team_b_player1_member, m.team_b_player2_member]
        .filter(Boolean).forEach((id) => memberIds.add(id!));
      [m.team_a_player1_guest, m.team_a_player2_guest,
       m.team_b_player1_guest, m.team_b_player2_guest]
        .filter(Boolean).forEach((id) => guestIds.add(id!));
    }

    // 이름 + member_type 조회.
    // members/guests는 anon/authenticated GRANT가 회수되어(0037, guests P0)
    // 서버 API를 거친다.
    const [memberRows, guestRows] = await Promise.all([
      memberIds.size > 0
        ? fetch(
            `/api/matches/session-members?clubId=${encodeURIComponent(currentClubId)}&ids=${[...memberIds].map(encodeURIComponent).join(",")}`
          )
            .then((res) => (res.ok ? res.json() : { members: [] }))
            .then((body) => body.members as { id: string; name: string; member_type: MemberType }[])
            .catch(() => {
              console.error("[MatchHistoryPageClient] session-members 조회 실패");
              return [];
            })
        : Promise.resolve([]),
      guestIds.size > 0
        ? fetch(
            `/api/matches/guest-names?clubId=${encodeURIComponent(currentClubId)}&ids=${[...guestIds].map(encodeURIComponent).join(",")}`
          )
            .then((res) => (res.ok ? res.json() : { guests: [] }))
            .then((body) => body.guests as { id: string; name: string }[])
            .catch(() => {
              console.error("[MatchHistoryPageClient] guest-names 조회 실패");
              return [];
            })
        : Promise.resolve([]),
    ]);

    const memberMap = new Map(
      (memberRows ?? []).map((m) => [m.id, { name: m.name, memberType: m.member_type }])
    );
    const guestMap = new Map((guestRows ?? []).map((g) => [g.id, g.name]));

    // 승패 집계
    const recordMap = new Map<string, PlayerRecord>();

    function addResult(id: string | null, isGuest: boolean, isWin: boolean) {
      if (!id) return;
      const key = (isGuest ? "G:" : "M:") + id;
      const info = isGuest
        ? { name: guestMap.get(id) ?? "게스트", memberType: null }
        : { name: memberMap.get(id)?.name ?? "알수없음", memberType: memberMap.get(id)?.memberType ?? null };
      const prev = recordMap.get(key) ?? { id, isGuest, memberType: info.memberType, name: info.name, wins: 0, losses: 0 };
      recordMap.set(key, { ...prev, wins: prev.wins + (isWin ? 1 : 0), losses: prev.losses + (isWin ? 0 : 1) });
    }

    for (const m of matchRows) {
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

    const sorted = [...recordMap.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aTot = a.wins + a.losses, bTot = b.wins + b.losses;
      if (bTot !== aTot) return bTot - aTot;
      return a.name.localeCompare(b.name, "ko");
    });

    setPlayerRecords(sorted);
    setLoadingDetail(false);
  }

  // ── 복원 ────────────────────────────────────────────────────────
  async function handleRestoreSession(sessionId: string) {
    if (!window.confirm("이 매치를 복원하고 출석 수정이 가능한 상태로 되돌릴까요?")) return;
    setRestoringSessionId(sessionId);
    const res = await fetch("/api/attendance-sessions/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetStatus: "closed" }),
    });
    const body = await res.json().catch(() => null);
    setRestoringSessionId(null);
    if (!res.ok) { toast.error(body?.error ?? "복원에 실패했습니다."); return; }
    toast.success("매치가 복원되었습니다.");
    setExpandedSessionId(null);
    loadSummaries();
  }

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-3">
        <p className="eyebrow-en text-clay-400">Match History</p>
        <h1 className="headline-kr text-4xl text-line-900">매치 히스토리</h1>
      </header>

      {/* 기록 탭 */}
      <div className="mb-4 flex gap-2">
        <span className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1.5 text-xs font-semibold text-clay-400">
          매치 히스토리
        </span>
        <Link href="/matches"
          className="rounded-sm border border-line-200/40 px-3 py-1.5 text-xs font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
          경기 기록
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : summaries.length === 0 ? (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-6 text-center">
          <p className="text-sm text-line-400">완료된 매치 기록이 없어요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map(({ session, matchCount }) => (
            <div key={session.id} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

              {/* 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(session.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
                      {session.session_date}
                    </span>
                    <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${
                      session.status === "archived"
                        ? "border border-line-200/40 bg-line-100 text-line-500"
                        : "border border-clay-400/30 bg-clay-400/10 text-clay-400"
                    }`}>
                      {session.status === "archived" ? "보관됨" : "완료됨"}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {MATCH_SESSION_DAY_LABEL[session.session_day]}
                    {(session.session_day === "holiday" || session.session_day === "custom") && ` · ${session.title}`}
                  </p>
                  <div className="mt-1">
                    {matchCount > 0 ? (
                      <span className="text-xs text-line-500">{matchCount}경기 진행</span>
                    ) : (
                      <span className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
                        경기 결과 미입력
                      </span>
                    )}
                  </div>
                </div>
                <span className="ml-2 flex-shrink-0 text-xs text-line-400">
                  {expandedSessionId === session.id ? "▲" : "▼"}
                </span>
              </button>

              {/* 상세 */}
              {expandedSessionId === session.id && (
                <div className="border-t border-line-200/30 px-4 pb-4 pt-3">
                  {isAdmin && session.status === "archived" && (
                    <button type="button" disabled={restoringSessionId === session.id}
                      onClick={() => handleRestoreSession(session.id)}
                      className="mb-3 w-full rounded-sm border border-clay-400/60 py-2 text-xs font-semibold text-clay-400 disabled:opacity-40">
                      {restoringSessionId === session.id ? "처리 중..." : "복원 (출석 수정 가능 상태로)"}
                    </button>
                  )}

                  {loadingDetail ? (
                    <p className="text-center text-sm text-line-400">불러오는 중...</p>
                  ) : playerRecords.length === 0 ? (
                    <div className="rounded-sm border border-line-200/40 bg-line-50 p-4 text-center">
                      <p className="text-[10px] font-semibold text-line-500">경기 결과 미입력</p>
                      <p className="mt-1 text-xs text-line-400">
                        경기 결과가 입력되면 참석자별 기록이 표시됩니다.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold text-line-500">참석자별 기록</p>
                      <div className="space-y-2">
                        {playerRecords.map((r) => {
                          const games = r.wins + r.losses;
                          const winRate = games > 0 ? Math.round((r.wins / games) * 100) : 0;
                          return (
                            <div key={(r.isGuest ? "G:" : "M:") + r.id}
                              className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[15px] font-semibold leading-snug text-line-900">
                                  {r.name}
                                </span>
                                <MemberTypeBadge isGuest={r.isGuest} memberType={r.memberType} />
                              </div>
                              <p className="text-right">
                                <span className="font-score text-[11px] tabular-nums text-line-500">{games}</span>
                                <span className="text-[11px] text-line-400">경기 · </span>
                                <span className="font-score text-[11px] tabular-nums text-gold">{r.wins}</span>
                                <span className="text-[11px] text-line-500">승 </span>
                                <span className="font-score text-[11px] tabular-nums text-line-400">{r.losses}</span>
                                <span className="text-[11px] text-line-400">패 · </span>
                                <span className="font-score text-[11px] tabular-nums text-line-500">{winRate}%</span>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
