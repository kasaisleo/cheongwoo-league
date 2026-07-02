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
  matchCount: number;  // 해당 매치에서 진행된 경기 수
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

export default function AttendanceHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  // manager 이상만 "보관 해제" 가능 — 권한 시스템 도입 전까지는 운영진 인증으로 대체
  // (useIsAdmin 훅이 /api/auth/status 조회를 담당한다)
  const isAdmin = useIsAdmin();
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<MemberAttendanceRow[]>([]);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);

  // 보관(archived)/마감(closed) 세션 목록 + 각 세션의 출석 요약을 불러온다.
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

  useEffect(() => {
    loadSummaries();
  }, [supabase]);

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
      // 게스트 이름 조회
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

      // 승패 집계 맵
      const recordMap = new Map<string, PlayerRecord>();

      function addResult(id: string | null, isGuest: boolean, isWin: boolean) {
        if (!id) return;
        const name = isGuest
          ? (guestNameMap.get(id) ?? "게스트")
          : (memberNameMap.get(id) ?? "알수없음");
        const key = (isGuest ? "G:" : "M:") + id;
        const prev = recordMap.get(key) ?? { id, name, isGuest, wins: 0, losses: 0 };
        recordMap.set(key, {
          ...prev,
          wins: prev.wins + (isWin ? 1 : 0),
          losses: prev.losses + (isWin ? 0 : 1),
        });
      }

      for (const match of matchRows) {
        const aWin = match.winner_team === "A";
        // 청팀(A)
        addResult(match.team_a_player1_member, false, aWin);
        addResult(match.team_a_player2_member, false, aWin);
        addResult(match.team_a_player1_guest, true, aWin);
        addResult(match.team_a_player2_guest, true, aWin);
        // 우팀(B)
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

  /** archived → closed로 되돌려, 운영진이 다시 출석을 보정할 수 있게 한다. */
  async function handleRestoreSession(sessionId: string) {
    if (!window.confirm("이 세션의 보관을 해제하고 명단 수정이 가능한 상태로 되돌릴까요?")) return;

    setRestoringSessionId(sessionId);
    const res = await fetch("/api/attendance-sessions/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetStatus: "closed" }),
    });
    const body = await res.json().catch(() => null);
    setRestoringSessionId(null);

    if (!res.ok) {
      toast.error(body?.error ?? "보관 해제에 실패했습니다.");
      return;
    }

    toast.success("보관이 해제되었습니다. 출석 화면에서 명단을 수정할 수 있어요.");
    setExpandedSessionId(null);
    loadSummaries();
  }

  const allMembersInDetail = detailRows.map((r) => r.member);

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clay-400" />
            <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
              Attendance History
            </p>
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
            출석 히스토리
          </h1>
        </div>
        <Link href="/attendance" className="text-xs font-semibold text-clay-400">
          ← 출석 체크
        </Link>
      </header>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : summaries.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          아직 보관된 출석 명단이 없어요.
        </Card>
      ) : (
        <div className="space-y-2">
          {summaries.map(({ session, attending, undecided, absent, matchCount }) => (
            <Card key={session.id} className="overflow-hidden p-0">
              <button
                type="button"
                onClick={() => toggleExpand(session.id)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-line-900">
                      {session.session_date} {MATCH_SESSION_DAY_LABEL[session.session_day]}
                      {(session.session_day === "holiday" || session.session_day === "custom") &&
                        ` · ${session.title}`}
                    </p>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                        session.status === "archived"
                          ? "bg-line-300 text-line-700"
                          : "bg-clay-400/10 text-clay-400"
                      }`}
                    >
                      {session.status === "archived" ? "보관됨" : "완료됨"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-line-500">
                    출석 {attending}명 · 불참 {absent}명
                  </p>
                  <p className="text-xs text-line-400">
                    {matchCount > 0 ? `경기 ${matchCount}게임 진행` : "경기 결과 미입력"}
                  </p>
                </div>
                <span className="text-line-500">{expandedSessionId === session.id ? "▲" : "▼"}</span>
              </button>

              {expandedSessionId === session.id && (
                <div className="border-t border-line-200 p-3">
                  {isAdmin && session.status === "archived" && (
                    <button
                      type="button"
                      disabled={restoringSessionId === session.id}
                      onClick={() => handleRestoreSession(session.id)}
                      className="mb-3 w-full rounded-sm border border-clay-400 py-2 text-xs font-semibold text-clay-400 disabled:opacity-40"
                    >
                      {restoringSessionId === session.id ? "처리 중..." : "보관 해제 (출석 수정 가능 상태로 복원)"}
                    </button>
                  )}
                  {loadingDetail ? (
                    <p className="text-center text-sm text-line-400">불러오는 중...</p>
                  ) : detailRows.length === 0 ? (
                    <p className="text-center text-sm text-line-400">출석 기록이 없어요.</p>
                  ) : (
                    <>
                    <p className="mb-2 text-[10px] font-semibold text-line-500">출석 현황</p>
                    <div className="space-y-1.5">
                      {detailRows.map(({ member, status }) => (
                        <div key={member.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-line-800">
                            {getDisambiguatedName(member, allMembersInDetail)}
                          </span>
                          <span
                            className={
                              status === "attending"
                                ? "text-xs font-semibold text-gold"
                                : status === "absent"
                                ? "text-xs font-semibold text-line-500"
                                : "text-xs font-semibold text-clay-400"
                            }
                          >
                            {status === "attending" ? "출석" : status === "absent" ? "불참" : "미정"}
                          </span>
                        </div>
                      ))}
                    </div>
                    </>
                  )}

                  {/* 참석자별 기록 */}
                  {playerRecords.length > 0 && (
                    <div className="mt-3 border-t border-line-200/30 pt-3">
                      <p className="mb-2 text-[10px] font-semibold text-line-500">참석자별 기록</p>
                      <div className="space-y-1.5">
                        {playerRecords.map((r) => (
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
                            <p className="font-score text-sm tabular-nums">
                              <span className="text-gold">{r.wins}승</span>
                              <span className="mx-1 text-line-400">·</span>
                              <span className="text-line-500">{r.losses}패</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
