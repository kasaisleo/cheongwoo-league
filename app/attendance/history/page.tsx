"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { AttendanceSession, AttendanceStatus, Member } from "@/lib/supabase/database.types";

interface SessionSummary {
  session: AttendanceSession;
  attending: number;
  undecided: number;
  absent: number;
}

interface MemberAttendanceRow {
  member: Member;
  status: AttendanceStatus;
}

export default function AttendanceHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<MemberAttendanceRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);

  // manager 이상만 "보관 해제" 가능 — 권한 시스템 도입 전까지는 운영진 인증으로 대체
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((body) => setIsAdmin(Boolean(body?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

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

    const { data: attendanceRows } =
      sessionIds.length > 0
        ? await supabase.from("attendance").select("session_id, status").in("session_id", sessionIds)
        : { data: [] };

    const result: SessionSummary[] = sessionList.map((session) => {
      const rows = (attendanceRows ?? []).filter((a) => a.session_id === session.id);
      return {
        session,
        attending: rows.filter((r) => r.status === "attending").length,
        undecided: rows.filter((r) => r.status === "undecided").length,
        absent: rows.filter((r) => r.status === "absent").length,
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
      return;
    }

    setExpandedSessionId(sessionId);
    setLoadingDetail(true);

    const [{ data: members }, { data: attendance }] = await Promise.all([
      supabase.from("members").select("*").order("nickname"),
      supabase.from("attendance").select("*").eq("session_id", sessionId),
    ]);

    const attendanceByMember = new Map((attendance ?? []).map((a) => [a.member_id, a]));

    const rows: MemberAttendanceRow[] = (members ?? [])
      .filter((m) => attendanceByMember.has(m.id))
      .map((member) => ({
        member,
        status: attendanceByMember.get(member.id)!.status as AttendanceStatus,
      }));

    setDetailRows(rows);
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
          {summaries.map(({ session, attending, undecided, absent }) => (
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
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        session.status === "archived"
                          ? "bg-line-300 text-line-700"
                          : "bg-amber-400/20 text-amber-400"
                      }`}
                    >
                      {session.status === "archived" ? "보관됨" : "확정됨"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-line-500">
                    출석 {attending} · 미정 {undecided} · 불참 {absent}
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
                      className="mb-3 w-full rounded-lg border border-clay-400 py-2 text-xs font-semibold text-clay-400 disabled:opacity-40"
                    >
                      {restoringSessionId === session.id ? "처리 중..." : "보관 해제 (출석 수정 가능 상태로 복원)"}
                    </button>
                  )}
                  {loadingDetail ? (
                    <p className="text-center text-sm text-line-400">불러오는 중...</p>
                  ) : detailRows.length === 0 ? (
                    <p className="text-center text-sm text-line-400">출석 기록이 없어요.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detailRows.map(({ member, status }) => (
                        <div key={member.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-line-800">
                            {getDisambiguatedName(member, allMembersInDetail)}
                          </span>
                          <span
                            className={
                              status === "attending"
                                ? "text-xs font-semibold text-court-400"
                                : status === "absent"
                                ? "text-xs font-semibold text-fault-400"
                                : "text-xs font-semibold text-amber-400"
                            }
                          >
                            {status === "attending" ? "출석" : status === "absent" ? "불참" : "미정"}
                          </span>
                        </div>
                      ))}
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
