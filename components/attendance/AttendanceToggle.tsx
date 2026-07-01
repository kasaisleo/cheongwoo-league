"use client";

import type { AttendanceStatus } from "@/lib/supabase/database.types";

interface AttendanceToggleProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
  loading?: boolean;   // 요청 중 — 버튼 전체 dim + 현재 버튼 스피너
  mode?: "full" | "pending"; // full=3버튼, pending=참석/불참만
}

const ACTIVE: Record<AttendanceStatus, string> = {
  attending: "border-gold/60 bg-gold/10 text-gold",
  undecided: "border-clay-400/60 bg-clay-400/10 text-clay-400",
  absent:    "border-line-300/40 bg-line-200 text-line-600",
};

const FULL_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "참석" },
  { status: "undecided", label: "미정" },
  { status: "absent",    label: "불참" },
];

const PENDING_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "참석" },
  { status: "absent",    label: "불참" },
];

export function AttendanceToggle({
  value,
  onChange,
  disabled = false,
  loading = false,
  mode = "full",
}: AttendanceToggleProps) {
  const options = mode === "pending" ? PENDING_OPTIONS : FULL_OPTIONS;

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const isActive  = value === opt.status;
        const isLoading = loading && isActive;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={disabled || loading}
            onClick={() => onChange(opt.status)}
            className={`rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
              isActive ? ACTIVE[opt.status] : "border-line-200/40 text-line-500"
            }`}
          >
            {isLoading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}
