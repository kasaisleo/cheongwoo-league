/**
 * lib/event-pairing/beam.ts — scheduling batch 공동 계획 + receding-horizon beam.
 *
 * 의존: types.ts, canonical.ts, power.ts, scheduling.ts, history.ts, candidates.ts
 *
 * 같은 batch 의 Court Game 을 함께 배정하고, 향후 batch depth 만큼 앞을 본 뒤
 * 첫 batch 만 확정한다. horizon 종료 시점의 누적 이력으로 다시 평가하므로
 * 개별 Game vector 를 단순 합산하지 않는다.
 */
import type {
  PairingResolvedConfig,
  PairingSchedulingBatch,
  PairingSlotMode,
  PairingTargetGameInput,
  PairingWarningCode,
  PairingEvidence,
} from "./types.ts";
import { canonicalLineupKey, compareVectors, seedTieHash } from "./canonical.ts";
import { integerVariance, powerDifferenceBp, type PairingPowerMap } from "./power.ts";
import { canonicalSort, parseUtcMs, sortByTime } from "./scheduling.ts";
import {
  buildHistory,
  currentStreakOf,
  playedPreviousBatch,
  type PairingHistory,
  type PlayedGame,
} from "./history.ts";
import {
  enumerateGameCandidates,
  type GameCandidate,
  type ParticipantFacts,
} from "./candidates.ts";

export interface BatchAssignment {
  readonly target: PairingTargetGameInput;
  readonly candidate: GameCandidate;
}

export interface BatchPlanResult {
  readonly ok: boolean;
  readonly assignments: readonly BatchAssignment[];
  readonly relaxed: readonly PairingWarningCode[];
  readonly shortage: PairingEvidence | null;
  readonly failedGameId: string | null;
  readonly candidatesEvaluated: number;
}

/** 확정된 assignment 를 이력용 PlayedGame 으로 변환한다. */
export function toPlayedGame(a: BatchAssignment): PlayedGame {
  return {
    id: a.target.id,
    position: a.target.position,
    courtPosition: a.target.courtPosition,
    sessionPosition: a.target.sessionPosition,
    sessionStartsAt: a.target.sessionStartsAt,
    sessionEndsAt: a.target.sessionEndsAt,
    teamA: a.candidate.teamA,
    teamB: a.candidate.teamB,
  };
}

export interface BeamContext {
  readonly participantIds: readonly string[];
  readonly slotMode: PairingSlotMode;
  readonly config: PairingResolvedConfig;
  readonly powers: PairingPowerMap;
  readonly facts: ReadonlyMap<string, ParticipantFacts>;
  readonly seed: string;
}

/**
 * 한 batch 안의 모든 Court Game 을 공동 계획한다.
 * Court 처리 순서는 canonical order 로 고정하므로 입력 순서와 무관하다.
 */
export function enumerateBatchPlans(
  baseGames: readonly PlayedGame[],
  batch: PairingSchedulingBatch,
  ctx: BeamContext,
): BatchPlanResult[] {
  const ordered = canonicalSort(batch.targets, ctx.slotMode);
  let partials: {
    assignments: BatchAssignment[];
    used: Set<string>;
    relaxed: PairingWarningCode[];
    shortage: PairingEvidence | null;
    failedGameId: string | null;
    evaluated: number;
  }[] = [{ assignments: [], used: new Set(), relaxed: [], shortage: null, failedGameId: null, evaluated: 0 }];

  const history = buildHistory(baseGames, ctx.participantIds, ctx.slotMode);

  for (let gi = 0; gi < ordered.length; gi++) {
    const target = ordered[gi];
    const slotsRemaining = 4 * (ordered.length - gi);
    const next: typeof partials = [];
    for (const p of partials) {
      if (p.failedGameId !== null) {
        next.push(p);
        continue;
      }
      const res = enumerateGameCandidates(
        ctx.participantIds,
        target,
        history,
        ctx.slotMode,
        ctx.config,
        ctx.powers,
        ctx.facts,
        ctx.seed,
        ctx.config.candidateTopK,
        p.used,
        slotsRemaining,
      );
      if (res.candidates.length === 0) {
        next.push({
          ...p,
          failedGameId: target.id,
          shortage: res.shortage,
          relaxed: [...p.relaxed, ...res.relaxed],
        });
        continue;
      }
      for (const c of res.candidates) {
        const used = new Set(p.used);
        for (const id of c.subset) used.add(id);
        next.push({
          assignments: [...p.assignments, { target, candidate: c }],
          used,
          relaxed: [...p.relaxed, ...res.relaxed],
          shortage: null,
          failedGameId: null,
          evaluated: p.evaluated + 1,
        });
      }
    }
    next.sort((a, b) => {
      const af = a.failedGameId !== null;
      const bf = b.failedGameId !== null;
      if (af !== bf) return af ? 1 : -1;
      const key = (x: typeof a): (number | string)[] =>
        x.assignments.flatMap((as) => [
          ...as.candidate.partnerVec,
          ...as.candidate.opponentVec,
          as.candidate.powerDiffBp,
        ]);
      const c = compareVectors(key(a), key(b));
      if (c !== 0) return c;
      return compareVectors(
        a.assignments.map((as) => as.candidate.seedHash),
        b.assignments.map((as) => as.candidate.seedHash),
      );
    });
    partials = next.slice(0, Math.max(ctx.config.beamWidth, 1));
  }

  return partials.map((p) => ({
    ok: p.failedGameId === null,
    assignments: p.assignments,
    relaxed: p.relaxed,
    shortage: p.shortage,
    failedGameId: p.failedGameId,
    candidatesEvaluated: p.evaluated,
  }));
}

/**
 * horizon 종료 시점의 누적 이력으로 beam state 를 평가한다.
 * 우선순위(사전순):
 *   appearance spread → appearance variance → consecutive excess total
 *   → consecutive excess member count → timed rest violation ms
 *   → partner vector → opponent vector → played-previous / soft streak
 *   → batch 별 power diff max → total → hand imbalance total → seed hash
 */
export function evaluateHorizon(
  allGames: readonly PlayedGame[],
  addedGames: readonly PlayedGame[],
  ctx: BeamContext,
): (number | string)[] {
  const h = buildHistory(allGames, ctx.participantIds, ctx.slotMode);
  const apps = ctx.participantIds.map((id) => h.appearance.get(id) ?? 0);
  const spread = apps.length > 0 ? Math.max(...apps) - Math.min(...apps) : 0;
  const variance = integerVariance(apps);

  let consecExcessTotal = 0;
  let consecExcessMembers = 0;
  for (const id of ctx.participantIds) {
    const excess = consecutiveExcessOf(id, h, ctx);
    if (excess > 0) {
      consecExcessTotal += excess;
      consecExcessMembers++;
    }
  }

  let restViolationMs = 0;
  if (ctx.slotMode === "timed" && ctx.config.requiredRestGapMs > 0) {
    for (const id of ctx.participantIds) {
      const gs = sortByTime(h.gamesOf.get(id) ?? []);
      for (let i = 1; i < gs.length; i++) {
        const prevEnd = parseUtcMs(gs[i - 1].sessionEndsAt) ?? parseUtcMs(gs[i - 1].sessionStartsAt);
        const curStart = parseUtcMs(gs[i].sessionStartsAt);
        if (prevEnd === null || curStart === null) continue;
        const gap = curStart - prevEnd;
        if (gap < ctx.config.requiredRestGapMs) restViolationMs += ctx.config.requiredRestGapMs - gap;
      }
    }
  }

  const pv = repeatVectorFrom([...h.partner.values()], ctx.config.partnerRepeatLimit);
  const ov = repeatVectorFrom([...h.opponent.values()], ctx.config.opponentRepeatLimit);

  let playedPrev = 0;
  let softStreak = 0;
  for (const id of ctx.participantIds) {
    if (playedPreviousBatch(id, h)) playedPrev++;
    softStreak += currentStreakOf(id, h, ctx.slotMode, ctx.config);
  }

  const byBatch = new Map<number, number>();
  for (const g of addedGames) {
    const diff = powerDifferenceBp(g.teamA, g.teamB, ctx.powers);
    const idx = h.batchIndexOf.get(batchKeyForGame(g, ctx.slotMode)) ?? 0;
    byBatch.set(idx, Math.max(byBatch.get(idx) ?? 0, diff));
  }
  const bd = [...byBatch.values()];
  const maxBatchPower = bd.length > 0 ? Math.max(...bd) : 0;
  const totalBatchPower = bd.reduce((a, b) => a + b, 0);

  let handTotal = 0;
  for (const g of addedGames) handTotal += handImbalanceOfTeams(g.teamA, g.teamB, ctx.facts);

  const hash = ctx.seed === "" ? "" : hashOfGames(addedGames, ctx.seed);

  return [
    spread,
    variance,
    consecExcessTotal,
    consecExcessMembers,
    restViolationMs,
    ...pv,
    ...ov,
    playedPrev,
    softStreak,
    maxBatchPower,
    totalBatchPower,
    handTotal,
    hash,
  ];
}

function repeatVectorFrom(counts: readonly number[], limit: number): number[] {
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

function consecutiveExcessOf(id: string, h: PairingHistory, ctx: BeamContext): number {
  const limit = ctx.config.consecutiveGamesLimit;
  let excess = 0;
  if (ctx.slotMode === "timed") {
    const gs = sortByTime(h.gamesOf.get(id) ?? []);
    let run = 0;
    for (let i = 0; i < gs.length; i++) {
      if (i === 0) run = 1;
      else {
        const prevEnd = parseUtcMs(gs[i - 1].sessionEndsAt) ?? parseUtcMs(gs[i - 1].sessionStartsAt);
        const curStart = parseUtcMs(gs[i].sessionStartsAt);
        const consec =
          prevEnd !== null &&
          curStart !== null &&
          (ctx.config.requiredRestGapMs > 0
            ? curStart - prevEnd < ctx.config.requiredRestGapMs
            : curStart - prevEnd === 0);
        run = consec ? run + 1 : 1;
      }
      if (run > limit) excess++;
    }
    return excess;
  }
  if (ctx.slotMode === "ordered") {
    const ps = h.positionsOf.get(id) ?? [];
    let run = 0;
    for (let i = 0; i < ps.length; i++) {
      run = i > 0 && ps[i] - ps[i - 1] === 1 ? run + 1 : 1;
      if (run > limit) excess++;
    }
    return excess;
  }
  const bs = h.batchesOf.get(id);
  if (bs === undefined) return 0;
  let run = 0;
  for (let b = 1; b <= h.batchCount; b++) {
    if (bs.has(b)) {
      run++;
      if (run > limit) excess++;
    } else run = 0;
  }
  return excess;
}

function batchKeyForGame(g: PlayedGame, slotMode: PairingSlotMode): string {
  if (slotMode === "timed") return `t${g.sessionStartsAt ?? ""}`;
  if (slotMode === "ordered") return `p${g.sessionPosition ?? 0}`;
  return `g${g.id}`;
}

function handImbalanceOfTeams(
  teamA: readonly string[],
  teamB: readonly string[],
  facts: ReadonlyMap<string, ParticipantFacts>,
): number {
  const left = (t: readonly string[]): number => t.filter((id) => facts.get(id)?.hand === "left").length;
  return Math.abs(left(teamA) - left(teamB));
}

function hashOfGames(games: readonly PlayedGame[], seed: string): string {
  const key = games.map((g) => canonicalLineupKey(g.teamA, g.teamB)).join("/");
  return seedTieHash(seed, key);
}

export interface PlanNextBatchResult {
  readonly ok: boolean;
  readonly assignments: readonly BatchAssignment[];
  readonly relaxed: readonly PairingWarningCode[];
  readonly shortage: PairingEvidence | null;
  readonly failedGameId: string | null;
  readonly tiedCount: number;
  readonly candidatesEvaluated: number;
  readonly effectiveLookahead: number;
}

/**
 * receding-horizon: 향후 batch depth 만큼 확장해 평가하고 첫 batch 만 확정한다.
 */
export function planNextBatch(
  baseGames: readonly PlayedGame[],
  upcoming: readonly PairingSchedulingBatch[],
  ctx: BeamContext,
): PlanNextBatchResult {
  const horizon = Math.min(ctx.config.lookaheadDepth, upcoming.length);
  let beams: {
    committed: PlayedGame[];
    first: BatchPlanResult | null;
    relaxed: PairingWarningCode[];
    shortage: PairingEvidence | null;
    failedGameId: string | null;
    evaluated: number;
    score: (number | string)[] | null;
  }[] = [
    { committed: [], first: null, relaxed: [], shortage: null, failedGameId: null, evaluated: 0, score: null },
  ];

  for (let h = 0; h < horizon; h++) {
    const batch = upcoming[h];
    const nextBeams: typeof beams = [];
    for (const b of beams) {
      if (b.failedGameId !== null) {
        nextBeams.push(b);
        continue;
      }
      const plans = enumerateBatchPlans([...baseGames, ...b.committed], batch, ctx);
      for (const p of plans) {
        if (!p.ok) {
          nextBeams.push({
            ...b,
            failedGameId: p.failedGameId,
            shortage: p.shortage,
            relaxed: [...b.relaxed, ...p.relaxed],
          });
          continue;
        }
        const added = p.assignments.map(toPlayedGame);
        nextBeams.push({
          committed: [...b.committed, ...added],
          first: b.first ?? p,
          relaxed: [...b.relaxed, ...p.relaxed],
          shortage: null,
          failedGameId: null,
          evaluated: b.evaluated + p.candidatesEvaluated,
          score: null,
        });
      }
    }
    for (const b of nextBeams) {
      if (b.failedGameId !== null) continue;
      b.score = evaluateHorizon([...baseGames, ...b.committed], b.committed, ctx);
    }
    nextBeams.sort((a, b) => {
      const af = a.failedGameId !== null;
      const bf = b.failedGameId !== null;
      if (af !== bf) return af ? 1 : -1;
      if (af) return 0;
      return compareVectors(a.score ?? [], b.score ?? []);
    });
    beams = nextBeams.slice(0, Math.max(ctx.config.beamWidth, 1));
  }

  const feasible = beams.filter((b) => b.failedGameId === null && b.first !== null);
  if (feasible.length === 0) {
    const b = beams[0];
    return {
      ok: false,
      assignments: [],
      relaxed: b?.relaxed ?? [],
      shortage: b?.shortage ?? null,
      failedGameId: b?.failedGameId ?? null,
      tiedCount: 0,
      candidatesEvaluated: b?.evaluated ?? 0,
      effectiveLookahead: horizon,
    };
  }
  const bestScore = feasible[0].score ?? [];
  const tiedCount = feasible.filter(
    (b) => compareVectors((b.score ?? []).slice(0, -1), bestScore.slice(0, -1)) === 0,
  ).length;
  const first = feasible[0].first as BatchPlanResult;
  return {
    ok: true,
    assignments: first.assignments,
    relaxed: feasible[0].relaxed,
    shortage: null,
    failedGameId: null,
    tiedCount,
    candidatesEvaluated: feasible[0].evaluated,
    effectiveLookahead: horizon,
  };
}
