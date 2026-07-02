"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import type { AttendanceSession, AttendanceStatus, Member } from "@/lib/supabase/database.types";

interface SessionSummary {
  session: AttendanceSession;
  attending: number;
  undecided: number;
  absent: number;
  matchCount: number;
}

interface MemberAttendanceRow {
  member: Member;
  status: AttendanceStatus;
}

interface PlayerRecord {
  id: string;
  name: string;
  isGuest: boolean;
  wins: number;
  losses: number;
}

export default function MatchesHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = useIsAdmin();
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<MemberAttendanceRow[]>([]);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);

  async function loadSummaries() {
    setLoading(true);
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("*")
      .in("status", ["closed", "archived"])
      .order("session_date", { ascending: false });

    const sessionList = (sessions ?? []) as AttendanceSession[];
    const sessionIds = sessionList.map((s) => s.id);

    const [{ data: attendanceRows }, { data: matchRows }] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from("attendance").select("session_id, status").in("session_id", sessionIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length > 0
        ? supabase.from("matches").select("id, session_id").in("session_id", sessionIds)
        : Promise.resolve({ data: [] }),
    ]);

    const result: SessionSummary[] = sessionList.map((session) => {
      const rows = (attendanceRows ?? []).filter((a) => a.session_id === session.id);
      const mCount = (matchRows ?? []).filter((m) => m.session_id === session.id).length;
      return {
        session,
        attending: rows.filter((r) => r.status === "attending").length,
        undecided: rows.filter((r) => r.status === "undecided").length,
        absent: rows.filter((r) => r.status === "absent").length,
        matchCount: mCount,
      };
    });

    setSummaries(result);
    setLoading(false);
  }

  useEffect(() => { loadSummaries(); }, [supabase]);

  async function toggleExpand(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setPlayerRecords([]);
      return;
    }
    setExpandedSessionId(sessionId);
    setLoadingDetail(true);

    const [{ data: members }, { data: attendance }, { data: matchRows }] = await Promise.all([
      supabase.from("members").select("*").order("nickname"),
      supabase.from("attendance").select("*").eq("session_id", sessionId),
      supabase.from("matches").select("*").eq("session_id", sessionId),
    ]);

    const attendanceByMember = new Map((attendance ?? []).map((a) => [a.member_id, a]));
    const rows: MemberAttendanceRow[] = (members ?? [])
      .filter((m) => attendanceByMember.has(m.id))
      .map((member) => ({
        member,
        status: attendanceByMember.get(member.id)!.status as AttendanceStatus,
      }));
    setDetailRows(rows);

    // 개인별 승패 계산
    if (matchRows && matchRows.length > 0) {
      const guestIds = new Set<string>();
      for (const m of matchRows) {
        [m.team_a_player1_guest, m.team_a_player2_guest,
         m.team_b_player1_guest, m.team_b_player2_guest]
          .filter(Boolean).forEach((id) => guestIds.add(id!));
      }
      const { data: guestRows } = guestIds.size > 0
        ? await supabase.from("guests").select("id, name").in("id", [...guestIds])
        : { data: [] };

      const memberNameMap = new Map((members ?? []).map((m) => [m.id, m.name]));
      const guestNameMap = new Map((guestRows ?? []).map((g) => [g.id, g.name]));
      const recordMap = new Map<string, PlayerRecord>();

      function addResult(id: string | null, isGuest: boolean, isWin: boolean) {
        if (!id) return;
        const name = isGuest ? (guestNameMap.get(id) ?? "게스트") : (memberNameMap.get(id) ?? "알수없음");
        const key = (isGuest ? "G:" : "M:") + id;
        const prev = recordMap.get(key) ?? { id, name, isGuest, wins: 0, losses: 0 };
        recordMap.set(key, { ...prev, wins: prev.wins + (isWin ? 1 : 0), losses: prev.losses + (isWin ? 0 : 1) });
      }

      for (const match of matchRows) {
        const aWin = match.winner_team === "A";
        addResult(match.team_a_player1_member, false, aWin);
        addResult(match.team_a_player2_member, false, aWin);
        addResult(match.team_a_player1_guest, true, aWin);
        addResult(match.team_a_player2_guest, true, aWin);
        addResult(match.team_b_player1_member, false, !aWin);
        addResult(match.team_b_player2_member, false, !aWin);
        addResult(match.team_b_player1_guest, true, !aWin);
        addResult(match.team_b_player2_guest, true, !aWin);
      }

      const sorted = [...recordMap.values()].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aTot = a.wins + a.losses;
        const bTot = b.wins + b.losses;
        if (bTot !== aTot) return bTot - aTot;
        return a.name.localeCompare(b.name, "ko");
      });
      setPlayerRecords(sorted);
    } else {
      setPlayerRecords([]);
    }
    setLoadingDetail(false);
  }

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
    toast.success("매치가 복원되었습니다. 출석 화면에서 수정할 수 있어요.");
    setExpandedSessionId(null);
    loadSummaries();
  }

  const allMembersInDetail = detailRows.map((r) => r.member);

  return (
    <main className="px-4 pt-6 pb-28">
      {/* ── 헤더 */}
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Match History</p>
          <h1 className="headline-kr text-4xl text-line-900">매치 히스토리</h1>
        </div>
      </header>

      {/* ── 기록 탭 */}
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
          {summaries.map(({ session, attending, absent, matchCount }) => (
            <div key={session.id} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              {/* 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(session.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  {/* 날짜 + 타입 배지 */}
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
                  {/* 매치명 */}
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {MATCH_SESSION_DAY_LABEL[session.session_day]}
                    {(session.session_day === "holiday" || session.session_day === "custom") && ` · ${session.title}`}
                  </p>
                  {/* 요약 */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs text-line-500">출석 {attending}명 · 불참 {absent}명</span>
                    {matchCount > 0 ? (
                      <span className="text-xs text-line-400">{matchCount}경기 진행</span>
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
                  ) : (
                    <>
                      {/* 참석자별 기록 — 경기 결과 있을 때 우선 표시 */}
                      {playerRecords.length > 0 && (
                        <div className="mb-4">
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
                                    {r.isGuest && (
                                      <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
                                        게스트
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-line-500">
                                    <span className="font-score text-[11px] tabular-nums">{games}</span>
                                    <span className="text-[11px]">경기 · </span>
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

                      {/* 출석 현황 */}
                      {detailRows.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-semibold text-line-500">출석 현황</p>
                          <div className="space-y-1">
                            {detailRows.map(({ member, status }) => (
                              <div key={member.id} className="flex items-center justify-between py-0.5">
                                <span className="text-[15px] font-semibold leading-snug text-line-900">
                                  {getDisambiguatedName(member, allMembersInDetail)}
                                </span>
                                <span className={
                                  status === "attending"
                                    ? "text-xs font-semibold text-gold"
                                    : status === "absent"
                                    ? "text-xs font-semibold text-line-400"
                                    : "text-xs font-semibold text-clay-400"
                                }>
                                  {status === "attending" ? "출석" : status === "absent" ? "불참" : "미정"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
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
