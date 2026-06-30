"use client";

import type { AttendanceStatus } from "@/lib/supabase/database.types";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

const ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  attending: "border-win bg-win text-win-foreground",
  undecided: "border-amber-400 bg-amber-400 text-line-900",
  absent: "border-loss bg-loss text-loss-foreground",
};

interface AttendanceStatusButtonsProps {
  currentStatus: AttendanceStatus | null;
  onSelect: (status: AttendanceStatus) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

/**
 * 참석/미정/불참 버튼 공통 컴포넌트.
 * 홈(HomeAttendanceSection), 출석 페이지, 마이페이지에서 재사용한다.
 *
 * - currentStatus와 일치하는 버튼만 활성 스타일(색상 채움)
 * - disabled=true면 전체 반투명 + 클릭 불가
 * - size: sm=마이페이지 소형, md=홈/출석 페이지 기본
 */
export function AttendanceStatusButtons({
  currentStatus,
  onSelect,
  disabled = false,
  size = "md",
}: AttendanceStatusButtonsProps) {
  const paddingClass = size === "sm" ? "py-1.5 text-xs" : "py-2 text-sm";

  return (
    <div className="flex gap-2">
      {(["attending", "undecided", "absent"] as AttendanceStatus[]).map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s)}
          className={`flex-1 rounded-sm border font-semibold transition-colors disabled:opacity-50 ${paddingClass} ${
            currentStatus === s
              ? ACTIVE_CLASS[s]
              : "border-line-200/60 bg-line-100 text-line-700 hover:border-line-300"
          }`}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
