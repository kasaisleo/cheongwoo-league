"use client";

import { useEffect, useState, useCallback } from "react";
import { MemberAttendanceCard } from "@/components/attendance/MemberAttendanceCard";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import type { AttendanceSession, AttendanceStatus } from "@/lib/supabase/database.types";

const HOME_SESSION_LIMIT = 2;
import { DEFAULT_CLUB_ID } from "@/lib/current-club";

const CHEONGWOO_CLUB_ID = DEFAULT_CLUB_ID;

interface SessionState {
  session: AttendanceSession;
  myStatus: AttendanceStatus | null;
  stats: { attending: number; undecided: number; absent: number };
}

export function HomeAttendanceSection() {
  const [memberId, setMemberId] = useState<string | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadSessions = useCallback(async (mId: string) => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: openSessions } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("club_id", CHEONGWOO_CLUB_ID)
      .eq("status", "open")
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(HOME_SESSION_LIMIT);

    if (!openSessions || openSessions.length === 0) {
      setSessions([]);
      return;
    }

    const sessionIds = openSessions.map((s) => s.id);

    const [{ data: myAttendances }, { data: allAttendances }] = await Promise.all([
      supabase
        .from("attendance")
        .select("session_id, status")
        .eq("member_id", mId)
        .in("session_id", sessionIds),
      supabase
        .from("attendance")
        .select("session_id, status")
        .in("session_id", sessionIds),
    ]);

    const myMap = new Map<string, AttendanceStatus>(
      (myAttendances ?? []).map((a) => [a.session_id as string, a.status as AttendanceStatus])
    );

    setSessions(
      openSessions.map((session) => {
        const rows = (allAttendances ?? []).filter((a) => a.session_id === session.id);
        return {
          session: session as AttendanceSession,
          myStatus: myMap.get(session.id) ?? null,
          stats: {
            attending: rows.filter((r) => r.status === "attending").length,
            undecided: rows.filter((r) => r.status === "undecided").length,
            absent: rows.filter((r) => r.status === "absent").length,
          },
        };
      })
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMemberId(null);
        setReady(true);
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("club_id", CHEONGWOO_CLUB_ID)
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      const mId = member?.id ?? null;
      setMemberId(mId);

      if (mId) {
        await loadSessions(mId);
      }

      setReady(true);
    })();
  }, [loadSessions]);

  async function handleStatusChange(sessionId: string, status: AttendanceStatus) {
    if (!memberId) return;

    setSessions((prev) =>
      prev.map((s) => (s.session.id === sessionId ? { ...s, myStatus: status } : s))
    );
    setSubmittingId(sessionId);

    try {
      const res = await fetch("/api/member/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "출석 변경에 실패했습니다.");
        await loadSessions(memberId);
      } else {
        const LABEL: Record<AttendanceStatus, string> = {
          attending: "참석",
          undecided: "미정",
          absent: "불참",
        };
        toast.success(`${LABEL[status]}으로 변경되었습니다.`);
        await loadSessions(memberId);
      }
    } catch {
      toast.error("출석 변경 중 오류가 발생했습니다.");
      await loadSessions(memberId);
    } finally {
      setSubmittingId(null);
    }
  }

  if (!ready || !memberId) return null;
  if (sessions.length === 0) return null;

  return (
    <section className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clay-400">
        이번 출석 신청
      </p>
      <div className="space-y-2">
        {sessions.map(({ session, myStatus, stats }) => (
          <MemberAttendanceCard
            key={session.id}
            session={session}
            myStatus={myStatus}
            stats={stats}
            onStatusChange={(s) => handleStatusChange(session.id, s)}
            submitting={submittingId === session.id}
            showStats
          />
        ))}
      </div>
    </section>
  );
}