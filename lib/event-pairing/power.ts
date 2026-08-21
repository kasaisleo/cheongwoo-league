/**
 * lib/event-pairing/power.ts — basis-point 정수 전력 산술.
 *
 * 의존: types.ts
 *
 * 모든 값은 0..10000 basis point 정수다. 실수 연산을 쓰지 않는다.
 * rating / members.grade / guests.skill_grade / guests.years_playing 은
 * 입력에도 계산에도 등장하지 않는다.
 */
import type {
  PairingParticipantInput,
  PairingPowerBreakdown,
} from "./types.ts";

export const BP_SCALE = 10000;
export const BP_NEUTRAL = 5000;

/** 안전 정수가 아니면 즉시 실패시킨다 — 조용한 정밀도 손실을 막는다. */
export class ArithmeticOverflowError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`PAIRING_ARITHMETIC_OVERFLOW: ${detail}`);
    this.name = "ArithmeticOverflowError";
    this.detail = detail;
  }
}

function assertSafe(n: number, label: string): number {
  if (!Number.isSafeInteger(n)) throw new ArithmeticOverflowError(`${label}=${n}`);
  return n;
}

/**
 * 비음수 정수 나눗셈의 half-up 반올림. PostgreSQL round(numeric) 의
 * round-half-away-from-zero 와 비음수 구간에서 일치한다.
 *   roundHalfUp(n, d) = floor((n*2 + d) / (d*2))
 */
export function roundHalfUp(n: number, d: number): number {
  assertSafe(n, "roundHalfUp.n");
  assertSafe(d, "roundHalfUp.d");
  if (d <= 0) throw new ArithmeticOverflowError(`roundHalfUp.d must be positive: ${d}`);
  if (n < 0) throw new ArithmeticOverflowError(`roundHalfUp.n must be non-negative: ${n}`);
  const num = assertSafe(n * 2 + d, "roundHalfUp.numerator");
  const den = assertSafe(d * 2, "roundHalfUp.denominator");
  return assertSafe(Math.floor(num / den), "roundHalfUp.result");
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** mapo_score 1..10 → 0..10000. */
export function mapoBpFromScore(score: number): number {
  return roundHalfUp((score - 1) * BP_SCALE, 9);
}

/**
 * 짝수 표본 중앙값의 이중 반올림을 피하려고 "2배 중앙값" 정수를 먼저 만든다.
 * known 표본이 없으면 중립 5000.
 */
export function mapoMedianBp(knownScores: readonly number[]): number {
  if (knownScores.length === 0) return BP_NEUTRAL;
  const s = [...knownScores].sort((a, b) => a - b);
  const n = s.length;
  const median2 = n % 2 === 1 ? 2 * s[(n - 1) / 2] : s[n / 2 - 1] + s[n / 2];
  return roundHalfUp((median2 - 2) * 5000, 9);
}

/**
 * draw-aware 축소 승률. win=1 / draw=0.5 / loss=0 을 정수로 표현한다.
 *   (2*wins + draws + 6) * 5000 / (total + 6)
 * 0경기면 중립 5000.
 */
export function recordBp(wins: number, losses: number, draws: number): number {
  const total = assertSafe(wins + losses + draws, "recordBp.total");
  if (total === 0) return BP_NEUTRAL;
  return roundHalfUp(assertSafe(2 * wins + draws + 6, "recordBp.num") * 5000, total + 6);
}

/** 경력. calculationYear 는 config_snapshot 값만 쓴다(서버 현재 연도 아님). */
export function experienceBp(calculationYear: number, tennisStartYear: number | null): number {
  if (tennisStartYear === null) return BP_NEUTRAL;
  const years = clamp(calculationYear - tennisStartYear, 0, 30);
  return roundHalfUp(years * BP_SCALE, 30);
}

/** 가중 합. mapo 50% / record 30% / experience 20%. */
export function powerBp(mapo: number, record: number, experience: number): number {
  const num = assertSafe(mapo * 5000 + record * 3000 + experience * 2000, "powerBp.num");
  return roundHalfUp(num, BP_SCALE);
}

export type PairingPowerMap = ReadonlyMap<string, PairingPowerBreakdown>;

/**
 * 참가자별 전력 분해. mapo 결측은 known 표본 중앙값으로, known 이 하나도 없으면
 * 중립으로 대체한다. 대체 여부는 warning 생성을 위해 breakdown 에 남긴다.
 */
export function buildPowerMap(
  participants: readonly PairingParticipantInput[],
  calculationYear: number,
): PairingPowerMap {
  const known: number[] = [];
  for (const p of participants) if (p.mapoScore !== null) known.push(p.mapoScore);
  const hasKnown = known.length > 0;
  const medianBp = mapoMedianBp(known);

  const map = new Map<string, PairingPowerBreakdown>();
  for (const p of participants) {
    const mapoMissing = p.mapoScore === null;
    const mBp = mapoMissing ? medianBp : mapoBpFromScore(p.mapoScore as number);
    const rBp = recordBp(p.wins, p.losses, p.draws);
    const eBp = experienceBp(calculationYear, p.tennisStartYear);
    map.set(p.id, {
      mapoBp: mBp,
      recordBp: rBp,
      experienceBp: eBp,
      powerBp: powerBp(mBp, rBp, eBp),
      mapoImputedFromMedian: mapoMissing && hasKnown,
      mapoImputedNeutral: mapoMissing && !hasKnown,
      recordNeutral: p.wins + p.losses + p.draws === 0,
      experienceNeutral: p.tennisStartYear === null,
    });
  }
  return map;
}

/** 팀 전력 합. 참가자가 map 에 없으면 내부 invariant 위반이다. */
export function teamPowerBp(team: readonly string[], powers: PairingPowerMap): number {
  let sum = 0;
  for (const id of team) {
    const b = powers.get(id);
    if (b === undefined) throw new ArithmeticOverflowError(`unknown participant in team: ${id}`);
    sum += b.powerBp;
  }
  return assertSafe(sum, "teamPowerBp");
}

/** 두 팀 전력차(절댓값). */
export function powerDifferenceBp(
  teamA: readonly string[],
  teamB: readonly string[],
  powers: PairingPowerMap,
): number {
  return Math.abs(teamPowerBp(teamA, powers) - teamPowerBp(teamB, powers));
}

/** 정수 분산 표현: n*Σx² − (Σx)². 실수 나눗셈을 쓰지 않는다. */
export function integerVariance(values: readonly number[]): number {
  const n = values.length;
  let sum = 0;
  let sumSq = 0;
  for (const v of values) {
    sum += v;
    sumSq += v * v;
  }
  assertSafe(sum, "integerVariance.sum");
  assertSafe(sumSq, "integerVariance.sumSq");
  return assertSafe(n * sumSq - sum * sum, "integerVariance.result");
}

/** 평균의 half-up 정수. 표본이 없으면 0. */
export function averageHalfUp(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  assertSafe(sum, "averageHalfUp.sum");
  return roundHalfUp(sum, values.length);
}
