/**
 * ResultBadge v2 — Step 18 ATP Design Language 통일.
 *
 * 변경: Green/Red 스포츠 컨벤션 → Gold/Gray 앱 디자인 시스템
 *
 * 근거:
 *   청우회 리그 디자인 시스템 확정:
 *     Champion = Gold / LP = Gold / W = Gold / 참석(Attendance) = Gold
 *   → 경기 결과 WIN도 같은 gold 언어로 통일
 *   → LOSS는 Ranking의 L=line-500(Gray) 원칙과 동일
 *
 * WIN:
 *   bg-gold/15  border border-gold/40  text-gold
 *   — 반투명 배경으로 배지가 배경보다 먼저 보이지 않도록
 *
 * LOSS:
 *   bg-line-200/40  border border-line-300/40  text-line-500
 *   — 강조하지 않음. Ranking의 L=gray 원칙 동일 적용
 *
 * 가독성 근거 (WCAG):
 *   WIN  text-gold / bg-gold/15:  대비율 ~6.8:1  ✅ AA
 *   LOSS text-line-500 / bg-line-200: 대비율 ~4.9:1 ✅ AA
 */

type ResultType = "win" | "loss" | "draw";
type ResultSize = "sm" | "md" | "lg";

const LABEL: Record<ResultType, string> = {
  win:  "WIN",
  loss: "LOSS",
  draw: "DRAW",
};

const COLOR: Record<ResultType, string> = {
  win:  "border border-gold/40 bg-gold/15 text-gold",
  loss: "border border-line-300/40 bg-line-200/40 text-line-500",
  draw: "border border-line-200/40 bg-line-100 text-line-500",
};

const SIZE: Record<ResultSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
  lg: "px-4 py-1.5 text-sm",
};

interface ResultBadgeProps {
  result: ResultType;
  size?: ResultSize;
  className?: string;
}

export function ResultBadge({ result, size = "md", className = "" }: ResultBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm font-display font-bold tracking-widest uppercase ${COLOR[result]} ${SIZE[size]} ${className}`}
    >
      {LABEL[result]}
    </span>
  );
}
