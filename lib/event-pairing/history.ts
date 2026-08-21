/**
 * lib/event-pairing/history.ts — 배정 이력 파생(출전·파트너·상대·연속·휴식).
 *
 * 의존: types.ts, canonical.ts, scheduling.ts
 *
 * base Game 과 이번 실행에서 확정한 Game 을 같은 방식으로 누적한다.
 * cancelled Game 은 애초에 input_snapshot 에 없다(0079 계약).
 */
import type {
  PairingLineupPlayer,
  PairingResolvedConfig,
  PairingSlotMode,
  PairingTeam,
} from "./types.ts";
import { pairKey } from "./canonical.ts";
import {
  batchKeyOf,
  canonicalSort,
  gapBeforeMs,
  isConsecutiveGapMs,
  parseUtcMs,
  sortByTime,
  type SchedulableGame,
} from "./scheduling.ts";

/** 이력 계산에 쓰는 확정 Game(=lineup 이 있는 Game). */
export interface PlayedGame extends SchedulableGame {
  readonly teamA: readonly string[];
  readonly teamB: readonly string[];
}

/** base Game lineup 을 teamA/teamB 배열로 정규화한다(slot 순서 고정). */
export function lineupToTeams(lineup: readonly PairingLineupPlayer[]): {
  teamA: string[];
  teamB: string[];
} {
  const pick = (team: PairingTeam): string[] =>
    lineup
      .filter((p) => p.team === team)
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((p) => p.participantId);
  return { teamA: pick("a"), teamB: pick("b") };
}

export interface PairingHistory {
  /** canonical 순서로 정렬된 확정 Game. */
  readonly games: readonly PlayedGame[];
  /** batch key → 1-based index. */
  readonly batchIndexOf: ReadonlyMap<string, number>;
  readonly batchCount: number;
  readonly appearance: ReadonlyMap<string, number>;
  readonly partner: ReadonlyMap<string, number>;
  readonly opponent: ReadonlyMap<string, number>;
  /** 참가자별 출전 Game(시간순/canonical 순). */
  readonly gamesOf: ReadonlyMap<string, readonly PlayedGame[]>;
  /** 참가자별 출전 batch index 집합. */
  readonly batchesOf: ReadonlyMap<string, ReadonlySet<number>>;
  /** 참가자별 출전 session.position 집합(ordered 전용). */
  readonly positionsOf: ReadonlyMap<string, readonly number[]>;
}

/**
 * 확정 Game 목록으로부터 이력을 만든다. 입력 배열을 mutate 하지 않는다.
 */
export function buildHistory(
  games: readonly PlayedGame[],
  participantIds: readonly string[],
  slotMode: PairingSlotMode,
): PairingHistory {
  const sorted = canonicalSort(games, slotMode);

  const batchIndexOf = new Map<string, number>();
  for (const g of sorted) {
    const k = batchKeyOf(g, slotMode);
    if (!batchIndexOf.has(k)) batchIndexOf.set(k, batchIndexOf.size + 1);
  }

  const appearance = new Map<string, number>();
  for (const id of participantIds) appearance.set(id, 0);
  const partner = new Map<string, number>();
  const opponent = new Map<string, number>();
  const gamesOf = new Map<string, PlayedGame[]>();
  const batchesOf = new Map<string, Set<number>>();
  const positionsOf = new Map<string, Set<number>>();

  for (const g of sorted) {
    const bIdx = batchIndexOf.get(batchKeyOf(g, slotMode)) as number;
    for (const id of [...g.teamA, ...g.teamB]) {
      appearance.set(id, (appearance.get(id) ?? 0) + 1);
      const gl = gamesOf.get(id);
      if (gl === undefined) gamesOf.set(id, [g]);
      else gl.push(g);
      const bs = batchesOf.get(id);
      if (bs === undefined) batchesOf.set(id, new Set([bIdx]));
      else bs.add(bIdx);
      if (g.sessionPosition !== null) {
        const ps = positionsOf.get(id);
        if (ps === undefined) positionsOf.set(id, new Set([g.sessionPosition]));
        else ps.add(g.sessionPosition);
      }
    }
    for (const t of [g.teamA, g.teamB]) {
      if (t.length === 2) {
        const k = pairKey(t[0], t[1]);
        partner.set(k, (partner.get(k) ?? 0) + 1);
      }
    }
    for (const a of g.teamA) {
      for (const b of g.teamB) {
        const k = pairKey(a, b);
        opponent.set(k, (opponent.get(k) ?? 0) + 1);
      }
    }
  }

  const positionsSorted = new Map<string, readonly number[]>();
  for (const [id, set] of positionsOf) positionsSorted.set(id, [...set].sort((a, b) => a - b));

  return {
    games: sorted,
    batchIndexOf,
    batchCount: batchIndexOf.size,
    appearance,
    partner,
    opponent,
    gamesOf,
    batchesOf,
    positionsOf: positionsSorted,
  };
}

// ── consecutive 판정 ────────────────────────────────────────────
/**
 * 이 target 에 배정했을 때의 연속 출전 수.
 *   timed   : 실제 gap(ms) 기준
 *   ordered : target 의 session.position 바로 앞(position-1)에 뛰었는지
 *   none    : 직전 canonical batch 에 뛰었는지
 */
export function afterStreakOf(
  participantId: string,
  target: SchedulableGame,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
): number {
  if (slotMode === "timed") {
    const played = history.gamesOf.get(participantId) ?? [];
    const gap = gapBeforeMs(played, target);
    if (gap === null) return 1;
    if (!isConsecutiveGapMs(gap, config.requiredRestGapMs)) return 1;
    return timedStreakOf(participantId, history, config) + 1;
  }
  if (slotMode === "ordered") {
    const p = target.sessionPosition;
    if (p === null) return 1;
    const ps = history.positionsOf.get(participantId) ?? [];
    if (!ps.includes(p - 1)) return 1;
    let s = 1;
    const upto = ps.filter((x) => x <= p - 1);
    for (let i = upto.length - 1; i >= 1; i--) {
      if (upto[i] - upto[i - 1] === 1) s++;
      else break;
    }
    return s + 1;
  }
  const bs = history.batchesOf.get(participantId);
  if (bs === undefined || !bs.has(history.batchCount)) return 1;
  return batchStreakOf(participantId, history) + 1;
}

/** timed: 시간순 마지막 구간의 연속 출전 수. */
export function timedStreakOf(
  participantId: string,
  history: PairingHistory,
  config: PairingResolvedConfig,
): number {
  const gs = sortByTime(history.gamesOf.get(participantId) ?? []);
  if (gs.length === 0) return 0;
  let s = 1;
  for (let i = gs.length - 1; i >= 1; i--) {
    const prevEnd = parseUtcMs(gs[i - 1].sessionEndsAt) ?? parseUtcMs(gs[i - 1].sessionStartsAt);
    const curStart = parseUtcMs(gs[i].sessionStartsAt);
    if (prevEnd === null || curStart === null) break;
    if (isConsecutiveGapMs(curStart - prevEnd, config.requiredRestGapMs)) s++;
    else break;
  }
  return s;
}

/** none: canonical batch index 연속성. */
export function batchStreakOf(participantId: string, history: PairingHistory): number {
  const bs = history.batchesOf.get(participantId);
  if (bs === undefined) return 0;
  let s = 0;
  for (let b = history.batchCount; b >= 1 && bs.has(b); b--) s++;
  return s;
}

/** ordered: session.position 값의 인접성(1→3 은 reset). */
export function orderedStreakOf(participantId: string, history: PairingHistory): number {
  const ps = history.positionsOf.get(participantId) ?? [];
  if (ps.length === 0) return 0;
  let s = 1;
  for (let i = ps.length - 1; i >= 1; i--) {
    if (ps[i] - ps[i - 1] === 1) s++;
    else break;
  }
  return s;
}

/** 현재 시점 연속 출전 수(slot_mode 별). */
export function currentStreakOf(
  participantId: string,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
): number {
  if (slotMode === "timed") return timedStreakOf(participantId, history, config);
  if (slotMode === "ordered") return orderedStreakOf(participantId, history);
  return batchStreakOf(participantId, history);
}

/** 전 구간 최대 연속 출전 수. */
export function maxStreakOf(
  participantId: string,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  config: PairingResolvedConfig,
): number {
  if (slotMode === "timed") {
    const gs = sortByTime(history.gamesOf.get(participantId) ?? []);
    if (gs.length === 0) return 0;
    let cur = 1;
    let best = 1;
    for (let i = 1; i < gs.length; i++) {
      const prevEnd = parseUtcMs(gs[i - 1].sessionEndsAt) ?? parseUtcMs(gs[i - 1].sessionStartsAt);
      const curStart = parseUtcMs(gs[i].sessionStartsAt);
      const consec =
        prevEnd !== null && curStart !== null && isConsecutiveGapMs(curStart - prevEnd, config.requiredRestGapMs);
      cur = consec ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    return best;
  }
  if (slotMode === "ordered") {
    const ps = history.positionsOf.get(participantId) ?? [];
    if (ps.length === 0) return 0;
    let cur = 1;
    let best = 1;
    for (let i = 1; i < ps.length; i++) {
      cur = ps[i] - ps[i - 1] === 1 ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    return best;
  }
  const bs = history.batchesOf.get(participantId);
  if (bs === undefined) return 0;
  let cur = 0;
  let best = 0;
  for (let b = 1; b <= history.batchCount; b++) {
    if (bs.has(b)) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  }
  return best;
}

/** 직전 batch 에 출전했는지(soft 지표). */
export function playedPreviousBatch(participantId: string, history: PairingHistory): boolean {
  const bs = history.batchesOf.get(participantId);
  return bs !== undefined && bs.has(history.batchCount);
}

/** target 시작 이전 마지막 종료와의 gap(ms). 이력 없으면 null. */
export function restGapMsFor(
  participantId: string,
  target: SchedulableGame,
  history: PairingHistory,
): number | null {
  return gapBeforeMs(history.gamesOf.get(participantId) ?? [], target);
}

/** 이 target 과 실제로 겹치는 기존 Game 에 배정된 참가자 집합. */
export function conflictingParticipants(
  target: SchedulableGame,
  history: PairingHistory,
  slotMode: PairingSlotMode,
  conflict: (a: SchedulableGame, b: SchedulableGame, m: PairingSlotMode) => boolean,
): Set<string> {
  const out = new Set<string>();
  for (const g of history.games) {
    if (conflict(g, target, slotMode)) {
      for (const id of [...g.teamA, ...g.teamB]) out.add(id);
    }
  }
  return out;
}
