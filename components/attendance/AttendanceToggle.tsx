"use client";

import type { AttendanceStatus } from "@/lib/supabase/database.types";

interface AttendanceToggleProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
  /**
   * 현재 서버 요청 중인 status.
   * 이 버튼에 스피너를 표시하고 나머지 버튼은 disabled.
   * null이면 로딩 없음.
   */
  pendingStatus?: AttendanceStatus | null;
  mode?: "full" | "pending"; // full=참석/미정/불참, pending=참석/불참만
}

const ACTIVE: Record<AttendanceStatus, string> = {
  attending: "border-gold/60 bg-gold/10 text-gold",
  undecided: "border-clay-400/60 bg-clay-400/10 text-clay-400",
  absent:    "border-line-300/40 bg-line-200 text-line-600",
};

const FULL_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "출석" },
  { status: "undecided", label: "미정" },
  { status: "absent",    label: "불참" },
];

const PENDING_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "출석" },
  { status: "absent",    label: "불참" },
];

export function AttendanceToggle({
  value,
  onChange,
  disabled = false,
  pendingStatus = null,
  mode = "full",
}: AttendanceToggleProps) {
  const options = mode === "pending" ? PENDING_OPTIONS : FULL_OPTIONS;
  const isLoading = pendingStatus !== null;

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const isActive  = value === opt.status;
        const isSaving  = pendingStatus === opt.status; // 이 버튼이 저장 중

        return (
          <button
            key={opt.status}
            type="button"
            disabled={disabled || isLoading} // 요청 중에는 모든 버튼 disabled
            onClick={() => !isSaving && onChange(opt.status)}
            className={`relative rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
              disabled || isLoading ? "opacity-50" : ""
            } ${isActive ? ACTIVE[opt.status] : "border-line-200/40 text-line-500"}`}
          >
            {isSaving ? (
              // 저장 중인 버튼에 스피너
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                <span>{opt.label}</span>
              </span>
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}
