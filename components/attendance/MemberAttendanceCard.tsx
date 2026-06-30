"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AttendanceStatusButtons } from "@/components/attendance/AttendanceStatusButtons";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { AttendanceSession, AttendanceStatus } from "@/lib/supabase/database.types";

/** 날짜 문자열(YYYY-MM-DD) → "2026.06.30" */
function formatSessionDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

const STATUS_TONE: Record<AttendanceStatus, "win" | "amber" | "loss"> = {
  attending: "win",
  undecided: "amber",
  absent: "loss",
};

interface AttendanceStats {
  attending: number;
  undecided: number;
  absent: number;
}

interface MemberAttendanceCardProps {
  session: AttendanceSession;
  myStatus: AttendanceStatus | null;
  stats?: AttendanceStats;
  onStatusChange: (status: AttendanceStatus) => void;
  submitting?: boolean;
  /** 출석 통계 한 줄 표시 여부. 홈/출석 페이지=true, 마이페이지=false */
  showStats?: boolean;
  /** 세션이 마감/보관된 경우 버튼 비활성 + 안내 메시지 */
  sessionClosed?: boolean;
}

/**
 * 세션 출석 신청 공통 카드.
 *
 * 표시 순서:
 *   1. session.title (메인 — 실제 세션 제목)
 *   2. 구분 · 날짜 (보조 — "이벤트매치 · 2026.06.30")
 *   3. 내 현재 상태 Badge
 *   4. AttendanceStatusButtons (참석/미정/불참)
 *   5. 출석 통계 (showStats=true일 때만)
 *
 * 세션 표시명 정책:
 *   메인 = session.title ("청우회 월례대회")
 *   보조 = MATCH_SESSION_DAY_LABEL[session_day] · session_date
 */
export function MemberAttendanceCard({
  session,
  myStatus,
  stats,
  onStatusChange,
  submitting = false,
  showStats = true,
  sessionClosed = false,
}: MemberAttendanceCardProps) {
  const typeLabel = MATCH_SESSION_DAY_LABEL[session.session_day];
  const dateLabel = formatSessionDate(session.session_date);

  return (
    <Card className="p-4">
      {/* 세션 제목 (메인) */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-line-900">{session.title}</p>
          <p className="mt-0.5 text-xs text-line-400">
            {typeLabel} · {dateLabel}
          </p>
        </div>
        {/* 내 현재 상태 */}
        {myStatus ? (
          <Badge tone={STATUS_TONE[myStatus]}>{STATUS_LABEL[myStatus]}</Badge>
        ) : (
          <Badge tone="neutral">미응답</Badge>
        )}
      </div>

      {/* 버튼 또는 마감 안내 */}
      {sessionClosed ? (
        <p className="text-center text-xs text-line-400">마감된 일정입니다.</p>
      ) : (
        <AttendanceStatusButtons
          currentStatus={myStatus}
          onSelect={onStatusChange}
          disabled={submitting}
          size="md"
        />
      )}

      {/* 출석 통계 */}
      {showStats && stats && (
        <p className="mt-2 text-center text-xs text-line-400">
          출석 {stats.attending} · 미정 {stats.undecided} · 불참 {stats.absent}
        </p>
      )}
    </Card>
  );
}
