/**
 * ResultBadge — 경기 결과를 ATP 스타일로 표시하는 배지.
 *
 * 사용 위치 (Step 15-3 이후 적용 예정):
 *   - 경기 카드 (MatchCard) 승자/패자 행
 *   - 회원 상세 최근 경기 섹션
 *   - 홈 최근 경기 카드
 *
 * result:
 *   "win"  → WIN  (win 컬러, 초록)
 *   "loss" → LOSS (loss 컬러, 빨강)
 *   "draw" → DRAW (neutral, 회색)
 *
 * size:
 *   "sm" → 소형 (경기 카드 인라인용, px-2 py-0.5 text-[10px])
 *   "md" → 기본 (기본 배지 크기, px-3 py-1 text-xs)
 *   "lg" → 강조 (Featured Match 전용, px-4 py-1.5 text-sm)
 */

type ResultType = "win" | "loss" | "draw";
type ResultSize = "sm" | "md" | "lg";

const LABEL: Record<ResultType, string> = {
  win: "WIN",
  loss: "LOSS",
  draw: "DRAW",
};

const COLOR: Record<ResultType, string> = {
  win: "bg-win text-win-foreground",
  loss: "bg-loss text-loss-foreground",
  draw: "bg-line-200 text-line-600",
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
