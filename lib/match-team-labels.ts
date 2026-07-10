/**
 * lib/match-team-labels.ts — 팀 명칭 매핑.
 *
 * DB/API 내부: winner_team = "A" | "B" 유지.
 *
 * [스킨 인식 API] — ClubSkin-2 이후 신규 코드에서 사용:
 *   getTeamLabels(skinKey) — skin_key 기반 팀 라벨 객체 반환
 *   cheongwoo: A="청팀", B="우팀"
 *   default/namaste: A="A팀", B="B팀"
 *
 * [Backward compat] — admin 컴포넌트(SessionMatchCard, EditMatchPageClient) 전용:
 *   TEAM_LABEL         — 청우회 고정 라벨 (변경 금지, admin 회귀 방지)
 *   teamSectionLabel() — TEAM_LABEL 기반
 *   winnerLabel()      — TEAM_LABEL 기반
 *   scoreLabel()       — TEAM_LABEL 기반
 */

// ── Skin-aware API ─────────────────────────────────────────

export interface TeamLabels {
  A: string;
  B: string;
}

/**
 * skin_key로 팀 라벨 객체를 반환한다.
 * 알 수 없는 skin_key는 기본값(A팀/B팀)으로 폴백한다.
 */
export function getTeamLabels(skinKey: string): TeamLabels {
  if (skinKey === "cheongwoo") return { A: "청팀", B: "우팀" };
  return { A: "A팀", B: "B팀" };
}

// ── Backward compat (admin 전용) ───────────────────────────

/** 청우회 admin 고정 라벨. 신규 코드에서 직접 사용 금지 — getTeamLabels() 사용. */
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
