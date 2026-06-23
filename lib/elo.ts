/**
 * 복식 경기용 ELO 레이팅 계산
 *
 * 방식: 팀 레이팅 = 두 선수 레이팅의 평균
 * 팀 단위로 표준 ELO 승/패를 계산한 뒤, 변동치를 같은 팀의 두 선수에게 동일하게 적용한다.
 * K-factor는 고정값 32 (등급별 차등 없음 — 합의된 단순 방식).
 */

const K_FACTOR = 32;

export interface EloInput {
  teamARating1: number;
  teamARating2: number;
  teamBRating1: number;
  teamBRating2: number;
  winner: "A" | "B";
}

export interface EloResult {
  teamAChange: number;
  teamBChange: number;
  teamANewRating1: number;
  teamANewRating2: number;
  teamBNewRating1: number;
  teamBNewRating2: number;
}

function expectedScore(ratingSelf: number, ratingOpponent: number): number {
  return 1 / (1 + Math.pow(10, (ratingOpponent - ratingSelf) / 400));
}

export function calculateDoublesElo(input: EloInput): EloResult {
  const { teamARating1, teamARating2, teamBRating1, teamBRating2, winner } = input;

  const teamARating = (teamARating1 + teamARating2) / 2;
  const teamBRating = (teamBRating1 + teamBRating2) / 2;

  const expectedA = expectedScore(teamARating, teamBRating);
  const expectedB = 1 - expectedA;

  const actualA = winner === "A" ? 1 : 0;
  const actualB = winner === "B" ? 1 : 0;

  const teamAChange = Math.round(K_FACTOR * (actualA - expectedA));
  const teamBChange = Math.round(K_FACTOR * (actualB - expectedB));

  return {
    teamAChange,
    teamBChange,
    teamANewRating1: teamARating1 + teamAChange,
    teamANewRating2: teamARating2 + teamAChange,
    teamBNewRating1: teamBRating1 + teamBChange,
    teamBNewRating2: teamBRating2 + teamBChange,
  };
}

export const INITIAL_RATING_BY_GRADE = {
  A: 1700,
  B: 1500,
  C: 1300,
  D: 1100,
} as const;
