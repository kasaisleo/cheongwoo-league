/**
 * LpBadge — LP 변동값을 ATP 스타일로 표시하는 배지.
 *
 * 사용 위치 (Step 15-3 이후 적용 예정):
 *   - 경기 카드 하단 (LP +25 / LP -10)
 *   - LP 이력 페이지 각 행
 *   - 회원 상세 LP 이력 섹션
 *
 * value:
 *   양수 → "LP +25" (win 컬러, 초록 배경)
 *   음수 → "LP -10" (loss 컬러, 빨강 배경)
 *   0    → "LP 0"   (neutral 회색)
 *
 * showPrefix: "LP" 접두어 표시 여부 (기본 true)
 *   false로 설정하면 "+25" / "-10" 만 표시 (콤팩트 모드)
 */

interface LpBadgeProps {
  value: number;
  showPrefix?: boolean;
  className?: string;
}

export function LpBadge({ value, showPrefix = true, className = "" }: LpBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const colorClass = isPositive
    ? "bg-win/15 text-win"
    : isNegative
      ? "bg-loss/15 text-loss"
      : "bg-line-200/60 text-line-500";

  const sign = isPositive ? "+" : "";
  const label = showPrefix ? `LP ${sign}${value}` : `${sign}${value}`;

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 font-score text-xs font-semibold tabular-nums ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
