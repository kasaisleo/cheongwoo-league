/**
 * RankMovement — 순위 변동을 ATP Ranking 스타일로 표시.
 *
 * 사용 위치 (Step 15-4 이후 적용 예정):
 *   - 랭킹 목록 각 행 우측 (▲2 ▼1 —)
 *   - 회원 상세 프로필 헤더
 *   - 홈 랭킹 하이라이트 섹션
 *
 * delta:
 *   양수 → ▲N (win 컬러, 초록) — 순위 상승
 *   음수 → ▼N (loss 컬러, 빨강) — 순위 하락
 *   0    → — (neutral) — 순위 유지
 *
 * showFlat: 0일 때 "—" 표시 여부 (기본 true)
 *   false면 변동 없을 때 null 반환 (공간 절약용)
 */

interface RankMovementProps {
  delta: number;
  showFlat?: boolean;
  className?: string;
}

export function RankMovement({ delta, showFlat = true, className = "" }: RankMovementProps) {
  if (delta === 0) {
    if (!showFlat) return null;
    return (
      <span className={`inline-flex items-center font-score text-xs font-medium text-line-500 ${className}`}>
        —
      </span>
    );
  }

  const isUp = delta > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-score text-xs font-semibold tabular-nums ${
        isUp ? "text-win" : "text-loss"
      } ${className}`}
    >
      {/* 삼각형 아이콘 — lucide 의존 없이 유니코드 사용 */}
      <span aria-hidden="true">{isUp ? "▲" : "▼"}</span>
      {Math.abs(delta)}
    </span>
  );
}
