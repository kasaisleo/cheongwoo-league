"use client";

import { clsx } from "clsx";
import type { AttendanceStatus } from "@/lib/supabase/database.types";

interface AttendanceToggleProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}

const OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: "attending", label: "참석" },
  { status: "undecided", label: "미정" },
  { status: "absent", label: "불참" },
];

const activeClasses: Record<AttendanceStatus, string> = {
  attending: "bg-court-400 text-line-25 border-court-400",
  undecided: "bg-amber-400 text-line-25 border-amber-400",
  absent: "bg-fault-400 text-line-25 border-fault-400",
};

export function AttendanceToggle({ value, onChange, disabled }: AttendanceToggleProps) {
  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((option) => (
        <button
          key={option.status}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.status)}
          className={clsx(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40",
            value === option.status ? activeClasses[option.status] : "border-line-200 text-line-500"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
