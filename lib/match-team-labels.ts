/**
 * lib/match-team-labels.ts — 청우회 리그 팀 명칭 매핑.
 *
 * DB/API 내부: winner_team = "A" | "B", team_a_player, team_b_player 유지.
 * UI 표시:    "A" → "청팀", "B" → "우팀"
 *
 * 사용:
 *   TEAM_LABEL["A"]  → "청팀"
 *   TEAM_LABEL["B"]  → "우팀"
 *   teamSectionLabel("A") → "청팀" (섹션 헤더용)
 *   winnerLabel("A") → "청팀 승리"
 */

export const TEAM_LABEL: Record<"A" | "B", string> = {
  A: "청팀",
  B: "우팀",
};

/** 섹션 헤더 라벨 */
export function teamSectionLabel(team: "A" | "B"): string {
  return TEAM_LABEL[team];
}

/** 승리팀 라벨 */
export function winnerLabel(team: "A" | "B"): string {
  return `${TEAM_LABEL[team]} 승리`;
}

/** 스코어 라벨 (타이브레이크 포함) */
export function scoreLabel(team: "A" | "B", isTiebreak = false): string {
  return isTiebreak ? `${TEAM_LABEL[team]} 타이브레이크` : TEAM_LABEL[team];
}
