/**
 * lib/event-pairing/candidates.ts — subset+split 병합 top-K 후보 생성.
 *
 * 의존: types.ts, canonical.ts, power.ts, scheduling.ts, history.ts
 *
 * category hard constraint 는 어떤 경우에도 완화하지 않는다. 운영 제약만
 * consecutive → rest gap → appearance 순으로, 그 축이 실제로 후보를 0개로
 * 만들었을 때만 완화하고 warning 을 남긴다.
 */
import type {
  PairingEvidence,
  PairingGenderCategory,
  PairingParticipantInput,
  PairingResolvedConfig,
  PairingSlotMode,
  PairingTargetGameInput,
  PairingWarningCode,
} from "./types.ts";
import { DEFAULT_REPEAT_LIMIT } from "./types.ts";
import { canonicalLineupKey, pairKey, seedTieHash } from "./canonical.ts";
import { powerDifferenceBp, type PairingPowerMap } from "./power.ts";
import { gamesConflict, type SchedulableGame } from "./scheduling.ts";
import {
  afterStreakOf,
  conflictingParticipants,
  restGapMsFor,
  type PairingHistory,
} from "./history.ts";

/** 4-vector: [limit 초과 총량, 초과 pair 수, 최대 반복, 총 반복량]. */
export type RepeatVector = readonly [number, number, number, number];

export interface SplitCandidate {
  readonly teamA: readonly string[];
  readonly teamB: readonly string[];
  readonly powerDiffBp: number;
  readonly handImbalance: number;
  readonly partnerVec: RepeatVector;
  readonly opponentVec: RepeatVector;
  readonly canonicalKey: string;
  readonly seedHash: string;
}

export interface GameCandidate extends SplitCandidate {
  readonly subset: readonly string[];
  /** 개별 Game 수준 정렬 vector(top-K 선별용). 최종 판정은 horizon 평가가 한다. */
  readonly vector: readonly (number | string)[];
}

export interface CandidateResult {
  readonly candidates: readonly GameCandidate[];
  readonly relaxed: readonly PairingWarningCode[];
  readonly shortage: PairingEvidence | null;
}

// ── 조합 ────────────────────────────────────────────────────────
function combinations4(arr: readonly string[]): string[][] {
  const out: string[][] = [];
  const n = arr.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) out.push([arr[a], arr[b], arr[c], arr[d]]);
  return out;
}

export interface ParticipantFacts {
  readonly gender: PairingParticipantInput["gender"];
  readonly hand: PairingParticipantInput["dominantHand"];
}

/**
 * category 를 만족하는 4인 subset 만 생성한다. 'unspecified' 는 mens/womens/
 * mixed 의 확정 성별로 쓰지 않는다. open 은 성별 제한이 없다.
 */
export function subsetsForCategory(
  pool: readonly string[],
  category: PairingGenderCategory,
  facts: ReadonlyMap<string, ParticipantFacts>,
): string[][] {
  const g = (id: string): string => facts.get(id)?.gender ?? "unspecified";
  if (category === "mens" || category === "womens") {
    const want = category === "mens" ? "male" : "female";
    return combinations4(pool.filter((id) => g(id) === want));
  }
  if (category === "mixed") {
    const males = pool.filter((id) => g(id) === "male");
    const females = pool.filter((id) => g(id) === "female");
    const out: string[][] = [];
    for (let i = 0; i < males.length; i++)
      for (let j = i + 1; j < males.length; j++)
        for (let k = 0; k < females.length; k++)
          for (let l = k + 1; l < females.length; l++)
            out.push([males[i], males[j], females[k], females[l]].sort());
    return out;
  }
  return combinations4(pool);
}

function splitsOf(four: readonly string[]): { teamA: string[]; teamB: string[] }[] {
  const [a, b, c, d] = four;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

function splitFitsCategory(
  teamA: readonly string[],
  teamB: readonly string[],
  category: PairingGenderCategory,
  facts: ReadonlyMap<string, ParticipantFacts>,
): boolean {
  if (category !== "mixed") return true;
  const g = (id: string): string => facts.get(id)?.gender ?? "unspecified";
  const ok = (t: readonly string[]): boolean =>
    (g(t[0]) === "male" && g(t[1]) === "female") || (g(t[0]) === "female" && g(t[1]) === "male");
  return ok(teamA) && ok(teamB);
}

function handImbalanceOf(
  teamA: readonly string[],
  teamB: readonly string[],
  facts: ReadonlyMap<string, ParticipantFacts>,
): number {
  const left = (t: readonly string[]): number => t.filter((id) => facts.get(id)?.hand === "left").length;
  return Math.abs(left(teamA) - left(teamB));
}

// ── repeat vector ───────────────────────────────────────────────
function repeatVector(counts: readonly number[], limit: number): RepeatVector {
  let excess = 0;
  let exceeded = 0;
  let max = 0;
  let total = 0;
  for (const c of counts) {
    if (c > limit) {
      excess += c - limit;
      exceeded++;
    }
    if (c > max) max = c;
    if (c > 1) total += c - 1;
  }
  return [excess, exceeded, max, total];
}

function partnerVectorOf(
  teamA: readonly string[],
  teamB: readonly string[],
  history: PairingHistory,
  limit: number,
): RepeatVector {
  const counts = [teamA, teamB].map((t) => history.partner.get(pairKey(t[0], t[1])) ?? 0);
  return repeatVector(counts, limit);
}

function opponentVectorOf(
  teamA: readonly string[],
  teamB: readonly string[],
  history: PairingHistory,
  limit: number,
): RepeatVector {
  const counts: number[] = [];
  for (const a of teamA) for (const b of teamB) counts.push(history.opponent.get(pairKey(a, b)) ?? 0);
  return repeatVector(counts, limit);
}

// ── eligible pool / admissibility ───────────────────────────────
function eligiblePool(
  participantIds: readonly string[],
  target: SchedulableGame,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
  alreadyInBatch: ReadonlySet<string>,
): string[] {
  const conflicting = conflictingParticipants(target, history, slotMode, gamesConflict);
  return participantIds.filter((id) => {
    if (alreadyInBatch.has(id)) return false;
    if (conflicting.has(id)) return false;
    if (config.maxGamesPerMember !== null && (history.appearance.get(id) ?? 0) >= config.maxGamesPerMember)
      return false;
    return true;
  });
}

interface Admissibility {
  readonly mustInclude: ReadonlySet<string>;
  readonly appAllowed: ReadonlySet<string>;
  readonly consecutiveBlocked: ReadonlySet<string>;
  readonly restBlocked: ReadonlySet<string>;
  readonly thresholdAppearance: number;
}

function admissibility(
  pool: readonly string[],
  target: SchedulableGame,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
  slotsRemainingInBatch: number,
): Admissibility {
  const appOf = (id: string): number => history.appearance.get(id) ?? 0;
  const sorted = [...pool].sort((a, b) => appOf(a) - appOf(b) || (a < b ? -1 : 1));
  const need = Math.min(slotsRemainingInBatch, sorted.length);
  const threshold = need > 0 ? appOf(sorted[need - 1]) : Number.MAX_SAFE_INTEGER;
  const mustInclude = new Set(pool.filter((id) => appOf(id) < threshold));
  const appAllowed = new Set(pool.filter((id) => appOf(id) <= threshold));

  const consecutiveBlocked = new Set(
    pool.filter((id) => afterStreakOf(id, target, history, slotMode, config) > config.consecutiveGamesLimit),
  );

  const restBlocked = new Set<string>();
  if (slotMode === "timed" && config.requiredRestGapMs > 0) {
    for (const id of pool) {
      const gap = restGapMsFor(id, target, history);
      if (gap !== null && gap < config.requiredRestGapMs) restBlocked.add(id);
    }
  }
  return { mustInclude, appAllowed, consecutiveBlocked, restBlocked, thresholdAppearance: threshold };
}

function categoryShortageEvidence(
  pool: readonly string[],
  category: PairingGenderCategory,
  facts: ReadonlyMap<string, ParticipantFacts>,
): PairingEvidence {
  const g = (id: string): string => facts.get(id)?.gender ?? "unspecified";
  const available = {
    male: pool.filter((id) => g(id) === "male").length,
    female: pool.filter((id) => g(id) === "female").length,
    unspecified: pool.filter((id) => g(id) === "unspecified").length,
  };
  const required: Record<string, number> =
    category === "mens"
      ? { male: 4, female: 0 }
      : category === "womens"
        ? { male: 0, female: 4 }
        : category === "mixed"
          ? { male: 2, female: 2 }
          : { any: 4 };
  const shortfall: Record<string, number> = {};
  for (const k of Object.keys(required)) {
    if (k === "any") continue;
    shortfall[k] = Math.max(0, required[k] - ((available as Record<string, number>)[k] ?? 0));
  }
  return {
    category,
    required,
    available,
    shortfall,
    poolSize: pool.length,
    ineligibleParticipants: pool.filter((id) => g(id) === "unspecified").sort(),
  };
}

// ── top-K 후보 ──────────────────────────────────────────────────
/**
 * 하나의 target Game 에 대한 정렬된 완성 lineup 후보 최대 limit 개.
 * 각 subset 에서 category 를 만족하는 split 전체를 계산하고
 * bestDiff + epsilon 밴드 안의 split 을 모두 후보에 포함한다(단일 split 로
 * 줄이지 않는다 — beam 이 다양성을 탐색할 수 있어야 한다).
 */
export function enumerateGameCandidates(
  participantIds: readonly string[],
  target: PairingTargetGameInput,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
  powers: PairingPowerMap,
  facts: ReadonlyMap<string, ParticipantFacts>,
  seed: string,
  limit: number,
  alreadyInBatch: ReadonlySet<string>,
  slotsRemainingInBatch: number,
): CandidateResult {
  const pool = eligiblePool(participantIds, target, history, slotMode, config, alreadyInBatch);
  const adm = admissibility(pool, target, history, slotMode, config, slotsRemainingInBatch);

  // category 는 절대 완화하지 않는다. 운영 제약만 순서대로 완화한다.
  const attempts: { ids: string[]; relax: PairingWarningCode[] }[] = [
    {
      ids: pool.filter(
        (id) => adm.appAllowed.has(id) && !adm.consecutiveBlocked.has(id) && !adm.restBlocked.has(id),
      ),
      relax: [],
    },
    {
      ids: pool.filter((id) => adm.appAllowed.has(id) && !adm.restBlocked.has(id)),
      relax: ["CONSECUTIVE_LIMIT_RELAXED"],
    },
    {
      ids: pool.filter((id) => adm.appAllowed.has(id)),
      relax: ["CONSECUTIVE_LIMIT_RELAXED", "REST_LIMIT_RELAXED"],
    },
    {
      ids: pool.filter((id) => !adm.consecutiveBlocked.has(id) && !adm.restBlocked.has(id)),
      relax: ["APPEARANCE_BALANCE_RELAXED"],
    },
    {
      ids: [...pool],
      relax: ["CONSECUTIVE_LIMIT_RELAXED", "REST_LIMIT_RELAXED", "APPEARANCE_BALANCE_RELAXED"],
    },
  ];

  let usePool: string[] | null = null;
  let applied: PairingWarningCode[] = [];
  for (const a of attempts) {
    if (subsetsForCategory(a.ids, target.genderCategory, facts).length > 0) {
      usePool = a.ids;
      applied = a.relax;
      break;
    }
  }
  if (usePool === null) {
    return {
      candidates: [],
      relaxed: [],
      shortage: categoryShortageEvidence(pool, target.genderCategory, facts),
    };
  }

  // 실제로 그 축이 차단을 만들고 있을 때만 완화 warning 을 남긴다.
  const relaxed: PairingWarningCode[] = [];
  for (const code of applied) {
    if (code === "CONSECUTIVE_LIMIT_RELAXED" && adm.consecutiveBlocked.size === 0) continue;
    if (code === "REST_LIMIT_RELAXED" && adm.restBlocked.size === 0) continue;
    relaxed.push(code);
  }

  const appearanceRelaxed = relaxed.includes("APPEARANCE_BALANCE_RELAXED");
  const slack = Math.max(0, slotsRemainingInBatch - 4);
  const minFromMust = appearanceRelaxed ? 0 : Math.max(0, Math.min(4, adm.mustInclude.size - slack));

  let subsets = subsetsForCategory(usePool, target.genderCategory, facts).filter(
    (four) => four.filter((id) => adm.mustInclude.has(id)).length >= minFromMust,
  );
  if (subsets.length === 0) subsets = subsetsForCategory(usePool, target.genderCategory, facts);

  const seen = new Set<string>();
  const out: GameCandidate[] = [];
  const label = target.id;

  for (const four of subsets) {
    const valid = splitsOf(four).filter((s) => splitFitsCategory(s.teamA, s.teamB, target.genderCategory, facts));
    if (valid.length === 0) continue;
    const withDiff = valid.map((s) => ({ ...s, diff: powerDifferenceBp(s.teamA, s.teamB, powers) }));
    let best = withDiff[0].diff;
    for (const s of withDiff) if (s.diff < best) best = s.diff;
    for (const s of withDiff) {
      if (s.diff > best + config.powerEpsilonBp) continue;
      const key = canonicalLineupKey(s.teamA, s.teamB);
      if (seen.has(key)) continue;
      seen.add(key);
      const pv = partnerVectorOf(s.teamA, s.teamB, history, config.partnerRepeatLimit);
      const ov = opponentVectorOf(s.teamA, s.teamB, history, config.opponentRepeatLimit);
      const hand = handImbalanceOf(s.teamA, s.teamB, facts);
      const hash = seedTieHash(seed, `${label}|${key}`);
      out.push({
        subset: [...four].sort(),
        teamA: s.teamA,
        teamB: s.teamB,
        powerDiffBp: s.diff,
        handImbalance: hand,
        partnerVec: pv,
        opponentVec: ov,
        canonicalKey: key,
        seedHash: hash,
        vector: [...pv, ...ov, hand, s.diff, hash],
      });
    }
  }

  out.sort((a, b) => {
    const n = Math.max(a.vector.length, b.vector.length);
    for (let i = 0; i < n; i++) {
      const x = a.vector[i];
      const y = b.vector[i];
      if (x === y) continue;
      if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1;
      return String(x) < String(y) ? -1 : 1;
    }
    return 0;
  });

  return { candidates: out.slice(0, limit), relaxed, shortage: null };
}

/** repeat limit 이 실제로 초과됐는지(REPEAT_LIMIT_RELAXED evidence 용). */
export function repeatOverageEvidence(
  history: PairingHistory,
  config: PairingResolvedConfig,
): PairingEvidence | null {
  const pv = [...history.partner.values()];
  const ov = [...history.opponent.values()];
  const pMax = pv.length > 0 ? Math.max(...pv) : 0;
  const oMax = ov.length > 0 ? Math.max(...ov) : 0;
  const pOver = pv.filter((c) => c > config.partnerRepeatLimit).length;
  const oOver = ov.filter((c) => c > config.opponentRepeatLimit).length;
  if (pOver === 0 && oOver === 0) return null;
  return {
    partnerConfiguredLimit: config.partnerRepeatLimit,
    partnerMaxObserved: pMax,
    partnerExceededPairCount: pOver,
    opponentConfiguredLimit: config.opponentRepeatLimit,
    opponentMaxObserved: oMax,
    opponentExceededPairCount: oOver,
    defaultLimitApplied: DEFAULT_REPEAT_LIMIT,
  };
}
