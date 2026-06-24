"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
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
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<MemberAttendanceRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 보관(archived)/마감(closed) 세션 목록 + 각 세션의 출석 요약을 불러온다.
  useEffect(() => {
    let isCurrent = true;

    async function load() {
      setLoading(true);

      const { data: sessions } = await supabase
        .from("attendance_sessions")
        .select("*")
        .in("status", ["closed", "archived"])
        .order("session_date", { ascending: false });

      if (!isCurrent) return;

      const sessionList = (sessions ?? []) as AttendanceSession[];
      const sessionIds = sessionList.map((s) => s.id);

      const { data: attendanceRows } =
        sessionIds.length > 0
          ? await supabase.from("attendance").select("session_id, status").in("session_id", sessionIds)
          : { data: [] };

      if (!isCurrent) return;

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

    load();
    return () => {
      isCurrent = false;
    };
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
            <Card key={session.id} className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpand(session.id)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-line-900">
                    {session.session_date} {MATCH_SESSION_DAY_LABEL[session.session_day]}
                    {(session.session_day === "holiday" || session.session_day === "custom") &&
                      ` · ${session.title}`}
                  </p>
                  <p className="mt-0.5 text-xs text-line-500">
                    출석 {attending} · 미정 {undecided} · 불참 {absent}
                  </p>
                </div>
                <span className="text-line-500">{expandedSessionId === session.id ? "▲" : "▼"}</span>
              </button>

              {expandedSessionId === session.id && (
                <div className="border-t border-line-200 p-3">
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
