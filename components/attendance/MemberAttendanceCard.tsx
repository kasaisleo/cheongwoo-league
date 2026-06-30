"use client";

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
 * MemberAttendanceCard v2 — Step 17 ATP 디자인 언어 통일.
 *
 * 변경:
 *   Card(bg-line-100) → 직접 div (bg-line-50) — Ranking 카드와 동일 surface
 *   accent bar 추가 — 현재 상태에 따라 win/amber/loss/neutral 색상
 *   padding 조정 — pl-6 (accent bar 공간) / pr-4 py-4
 *   날짜 text-line-400 → text-line-500 (가독성)
 *   통계 text-center → 좌측 정렬
 *
 * 유지:
 *   AttendanceStatusButtons — 사용성 우선, 구조 변경 없음
 *   Badge — 내 상태 우측 상단
 *   버튼 크기/간격 — 기존 그대로
 *
 * 목표: "Ranking과 같은 앱에서 나온 것처럼" — Ranking 카드로 만드는 게 아님.
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

  // accent bar — "액션 가능한 카드" 신호. 상태는 배지와 버튼이 담당하므로 bar는 clay 단일색.
  // (이전: 상태별 win/loss/amber/line → 정보 과다, Ranking 언어와 충돌)
  const accentColor = "bg-clay-400/50";

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      {/* 좌측 accent bar — 내 출석 상태 반영 */}
      <div className={`absolute left-0 top-0 h-full w-1 ${accentColor}`} />

      <div className="px-4 py-4 pl-6">
        {/* 세션 제목 + 내 상태 배지 */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-line-900">{session.title}</p>
            <p className="mt-0.5 text-xs text-line-500">
              {typeLabel} · {dateLabel}
            </p>
          </div>
          {myStatus ? (
            <Badge tone={STATUS_TONE[myStatus]}>{STATUS_LABEL[myStatus]}</Badge>
          ) : (
            <Badge tone="neutral">미응답</Badge>
          )}
        </div>

        {/* 참석/미정/불참 버튼 — 사용성 우선 유지 */}
        {sessionClosed ? (
          <p className="text-xs text-line-400">마감된 일정입니다.</p>
        ) : (
          <AttendanceStatusButtons
            currentStatus={myStatus}
            onSelect={onStatusChange}
            disabled={submitting}
            size="md"
          />
        )}

        {/* 출석 통계 — 좌측 정렬, text-line-500으로 통일 */}
        {showStats && stats && (
          <p className="mt-2 text-xs text-line-500">
            출석 {stats.attending} · 미정 {stats.undecided} · 불참 {stats.absent}
          </p>
        )}
      </div>
    </div>
  );
}
