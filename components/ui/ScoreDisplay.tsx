/**
 * ScoreDisplay — 경기 점수를 ATP 스타일로 표시하는 컴포넌트.
 *
 * 사용 위치 (Step 15-3 이후 적용 예정):
 *   - 경기 카드 중앙 점수 영역 (6 : 3, 타이브레이크 포함)
 *   - 홈 최근 경기 카드
 *
 * 두 가지 표시 방식:
 *
 * 1. Simple (variant="simple"): 현재 청우회 방식과 호환
 *    scoreA, scoreB, tiebreakA?, tiebreakB?
 *    → "6 : 3" 또는 "6 : 7 (5-7)"
 *
 * 2. Boxes (variant="boxes"): ATP Tour / 시안 레퍼런스 방식
 *    각 점수를 별도 박스로 표시, 승자 점수는 색상 강조
 *    winnerSide: "a" | "b" — 어느 팀이 승자인지
 */

interface SimpleScoreProps {
  variant?: "simple";
  scoreA: number;
  scoreB: number;
  tiebreakA?: number | null;
  tiebreakB?: number | null;
  className?: string;
}

interface BoxesScoreProps {
  variant: "boxes";
  scoreA: number;
  scoreB: number;
  tiebreakA?: number | null;
  tiebreakB?: number | null;
  winnerSide?: "a" | "b";
  className?: string;
}

type ScoreDisplayProps = SimpleScoreProps | BoxesScoreProps;

export function ScoreDisplay(props: ScoreDisplayProps) {
  const { scoreA, scoreB, tiebreakA, tiebreakB, className = "" } = props;
  const variant = props.variant ?? "simple";

  if (variant === "simple") {
    return (
      <span
        className={`font-score font-bold tabular-nums text-line-900 ${className}`}
      >
        {scoreA} : {scoreB}
        {tiebreakA != null && tiebreakB != null && (
          <span className="ml-1 text-xs font-normal text-line-500">
            ({tiebreakA}-{tiebreakB})
          </span>
        )}
      </span>
    );
  }

  // variant === "boxes"
  const winnerSide = (props as BoxesScoreProps).winnerSide;
  const aWon = winnerSide === "a";
  const bWon = winnerSide === "b";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {/* 상단: Team A 점수 */}
      <div className="relative flex items-center justify-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-sm font-score text-lg font-bold tabular-nums ${
            aWon ? "bg-win/20 text-win" : "text-line-500"
          }`}
        >
          {scoreA}
        </span>
        {tiebreakA != null && (
          <sup className="absolute -top-1 -right-1.5 font-score text-[9px] text-line-400">
            {tiebreakA}
          </sup>
        )}
      </div>
      {/* 하단: Team B 점수 */}
      <div className="relative flex items-center justify-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-sm font-score text-lg font-bold tabular-nums ${
            bWon ? "bg-win/20 text-win" : "text-line-500"
          }`}
        >
          {scoreB}
        </span>
        {tiebreakB != null && (
          <sup className="absolute -top-1 -right-1.5 font-score text-[9px] text-line-400">
            {tiebreakB}
          </sup>
        )}
      </div>
    </div>
  );
}
