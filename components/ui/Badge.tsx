import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type BadgeTone = "clay" | "court" | "amber" | "fault" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  clay: "bg-clay-400 text-line-25",
  court: "bg-court-400/20 text-court-400",
  amber: "bg-amber-400/20 text-amber-400",
  fault: "bg-fault-50 text-fault-400",
  neutral: "bg-line-200 text-line-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

/** 회원 등급(A/B/C/D)에 대응하는 톤 매핑 */
export function gradeTone(grade: "A" | "B" | "C" | "D"): BadgeTone {
  switch (grade) {
    case "A":
      return "clay";
    case "B":
      return "court";
    case "C":
      return "amber";
    case "D":
      return "neutral";
  }
}
