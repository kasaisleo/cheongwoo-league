"use client";

import { useEffect, useState, useCallback } from "react";
import { MemberAttendanceCard } from "@/components/attendance/MemberAttendanceCard";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import type { SessionSummary } from "@/lib/match-session-label";
import type { AttendanceStatus } from "@/lib/supabase/database.types";

const HOME_SESSION_LIMIT = 2;

interface HomeAttendanceSectionProps {
  currentClubId: string;
}

interface AttendanceCounts {
  attending: number;
  undecided: number;
  absent: number;
}

interface SessionState {
  session: SessionSummary;
  myStatus: AttendanceStatus | null;
  stats: AttendanceCounts;
}

export function HomeAttendanceSection({ currentClubId }: HomeAttendanceSectionProps) {
  const [memberId, setMemberId] = useState<string | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 세션 목록은 public-sessions API(open만), 내 상태+집계는 roster API(sessionId 모드,
  // selfStatus는 서버가 auth 쿠키로 도출)에서 가져온다 — 둘 다 Client direct 조회가 아니다.
  const loadSessions = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams({ clubId: currentClubId, statuses: "open", order: "asc" });
    const allOpen = await fetch(`/api/attendance/public-sessions?${params}`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((body) => body.sessions as SessionSummary[])
      .catch(() => {
        console.error("[HomeAttendanceSection] public-sessions 조회 실패");
        return [] as SessionSummary[];
      });

    const openSessions = allOpen
      .filter((s) => s.session_date >= today)
      .slice(0, HOME_SESSION_LIMIT);

    if (openSessions.length === 0) {
      setSessions([]);
      return;
    }

    const defaultCounts: AttendanceCounts = { attending: 0, undecided: 0, absent: 0 };

    const rosterResults = await Promise.all(
      openSessions.map((session) =>
        fetch(`/api/attendance/roster?${new URLSearchParams({ clubId: currentClubId, sessionId: session.id })}`)
          .then((res) => (res.ok ? res.json() : { counts: defaultCounts, selfStatus: null }))
          .catch(() => ({ counts: defaultCounts, selfStatus: null }))
      )
    );

    setSessions(
      openSessions.map((session, i) => ({
        session,
        myStatus: (rosterResults[i]?.selfStatus ?? null) as AttendanceStatus | null,
        stats: rosterResults[i]?.counts ?? defaultCounts,
      }))
    );
  }, [currentClubId]);

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

      const body = await fetch(`/api/member/self?clubId=${currentClubId}`)
        .then((res) => res.json())
        .catch(() => ({ memberId: null }));

      const mId = body?.memberId ?? null;
      setMemberId(mId);

      if (mId) {
        await loadSessions();
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
        await loadSessions();
      } else {
        const LABEL: Record<AttendanceStatus, string> = {
          attending: "참석",
          undecided: "미정",
          absent: "불참",
        };
        toast.success(`${LABEL[status]}으로 변경되었습니다.`);
        await loadSessions();
      }
    } catch {
      toast.error("출석 변경 중 오류가 발생했습니다.");
      await loadSessions();
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