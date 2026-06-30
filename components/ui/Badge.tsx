import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

/**
 * Badge v2 — Step 16-2 semantic token 정리.
 *
 * tone 체계:
 *   win     = 참석 / 승리 / 긍정 상태  → bg-win/20 text-win
 *   loss    = 불참 / 패배 / 부정 상태  → bg-loss/20 text-loss
 *   amber   = 미정 / 보류 / pending   → bg-amber-400/20 text-amber-400
 *   clay    = primary / CTA / active  → bg-clay-400 text-line-25
 *   neutral = 일반 태그 / 구분용       → bg-line-200 text-line-700
 *   fault   = danger / 삭제 / 오류    → bg-fault-50 text-fault-400  (기존 유지)
 *   court   = 보조 장식 / 코트 정보용  → bg-court-400/20 text-court-400 (기존 유지)
 *
 * 제거된 사용 패턴:
 *   court → 참석/승리/긍정 의미 사용 금지 (→ win으로 교체)
 *   fault → 불참/패배 의미 사용 금지    (→ loss로 교체)
 */

type BadgeTone =
  | "win"      // 참석 / 승리 / 긍정
  | "loss"     // 불참 / 패배 / 부정
  | "amber"    // 미정 / 보류
  | "clay"     // primary CTA / active
  | "court"    // 보조 장식 (코트 컬러, 카카오 연동 등)
  | "fault"    // danger / 삭제
  | "neutral"; // 일반 태그

const toneClasses: Record<BadgeTone, string> = {
  win:     "bg-win/20 text-win",
  loss:    "bg-loss/20 text-loss",
  amber:   "bg-amber-400/20 text-amber-400",
  clay:    "bg-clay-400 text-line-25",
  court:   "bg-court-400/20 text-court-400",
  fault:   "bg-fault-50 text-fault-400",
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

/** @deprecated court/fault 대신 win/loss 사용 권장 */
export function gradeTone(grade: "A" | "B" | "C" | "D"): BadgeTone {
  switch (grade) {
    case "A": return "clay";
    case "B": return "court";
    case "C": return "amber";
    case "D": return "neutral";
  }
}
