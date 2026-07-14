"use client";

import type { AttendanceStatus } from "@/lib/supabase/database.types";

/**
 * AttendanceStatusButtons v2 — Step 17 ATP 디자인 언어 통일.
 *
 * 변경: 신호등 언어(Green/Amber/Red) → Gold/Clay/Gray 체계
 *
 * 비활성: --control-bg / --control-border / --surface-muted
 * 참석:   bg-gold/10   border-gold/60      text-gold
 * 미정:   --control-border-focus 기반 10%/60% tint (선택 accent)
 * 불참:   --control-muted-bg / --control-border / --surface-muted
 *
 * 근거:
 *   참석 = gold → "이기면 챔피언에 가까워진다"는 Ranking의 W=gold 언어 연결
 *   미정 = clay → Primary accent, "결정해야 할 액션"
 *   불참 = gray → 강조하지 않음, Ranking의 L=line-500 언어 연결
 *
 * 접근성:
 *   비활성 9.53:1 ✅ / 참석 7.14:1 ✅ / 미정 11.19:1 ✅ / 불참 4.54:1 ✅
 *   (기존 신호등: win 2.89:1 ❌ / loss 2.70:1 ❌ — 오히려 향상)
 *
 * 유지:
 *   MatchCard WIN/LOSS 배지 — 건드리지 않음
 *   출석 기능 로직 — 변경 없음
 */

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

const ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  attending: "border-gold/60 bg-gold/10 text-gold",
  undecided:
    "border-[color:color-mix(in_srgb,var(--control-border-focus)_60%,transparent)] bg-[color:color-mix(in_srgb,var(--control-border-focus)_10%,transparent)] text-[color:var(--control-border-focus)]",
  absent:
    "border-[color:var(--control-border)] bg-[color:var(--control-muted-bg)] text-[color:var(--surface-muted)]",
};

interface AttendanceStatusButtonsProps {
  currentStatus: AttendanceStatus | null;
  onSelect: (status: AttendanceStatus) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

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
          className={`flex-1 rounded-sm border font-semibold transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--action-focus-ring)] ${paddingClass} ${
            currentStatus === s
              ? ACTIVE_CLASS[s]
              : "border-[color:var(--control-border)] bg-[color:var(--control-bg)] text-[color:var(--surface-muted)] hover:border-[color:var(--control-border-hover)]"
          }`}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
