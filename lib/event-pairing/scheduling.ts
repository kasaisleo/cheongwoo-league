/**
 * lib/event-pairing/scheduling.ts — canonical 순서 / scheduling batch /
 * interval overlap / consecutive · rest gap 판정.
 *
 * 의존: types.ts, canonical.ts
 *
 * timed 는 "겹침 연결 성분" 을 쓰지 않는다 — interval overlap 은 추이적이지
 * 않기 때문이다(C-4B). 충돌은 half-open [start,end) pairwise overlap 이고,
 * batch 는 동일 starts_at 이다. 모든 시간 비교는 밀리초 정수로만 한다.
 */
import type {
  PairingBaseGameInput,
  PairingSchedulingBatch,
  PairingSlotMode,
  PairingTargetGameInput,
} from "./types.ts";
import { compareVectors } from "./canonical.ts";

/** 엔진이 다루는 Game 의 최소 스케줄 정보(target/base 공통). */
export interface SchedulableGame {
  readonly id: string;
  readonly position: number;
  readonly courtPosition: number | null;
  readonly sessionPosition: number | null;
  readonly sessionStartsAt: string | null;
  readonly sessionEndsAt: string | null;
}

const UTC_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** 0079 가 만드는 UTC 초 단위 형식만 허용한다. 로컬 timezone 을 쓰지 않는다. */
export function isCanonicalUtcTimestamp(v: unknown): v is string {
  if (typeof v !== "string" || !UTC_TS_RE.test(v)) return false;
  const ms = Date.parse(v);
  return Number.isSafeInteger(ms);
}

/** UTC 문자열 → epoch ms 정수. 형식이 아니면 null. */
export function parseUtcMs(v: string | null): number | null {
  if (v === null) return null;
  if (!isCanonicalUtcTimestamp(v)) return null;
  return Date.parse(v);
}

// ── canonical 순서 ──────────────────────────────────────────────
/**
 * slot_mode 별 canonical 정렬 키.
 *   none    : (position, id)
 *   ordered : (sessionPosition, courtPosition, position, id)
 *   timed   : (startsAt, endsAt, courtPosition, sessionPosition, id)
 * Court 입력 순서와 무관하게 같은 결과를 만든다.
 */
export function canonicalSortKey(
  g: SchedulableGame,
  slotMode: PairingSlotMode,
): readonly (number | string)[] {
  if (slotMode === "timed") {
    return [g.sessionStartsAt ?? "", g.sessionEndsAt ?? "", g.courtPosition ?? 0, g.sessionPosition ?? 0, g.id];
  }
  if (slotMode === "ordered") {
    return [g.sessionPosition ?? 0, g.courtPosition ?? 0, g.position, g.id];
  }
  return [g.position, g.id];
}

/** 입력 배열을 mutate 하지 않고 canonical 순서로 정렬한 새 배열을 만든다. */
export function canonicalSort<T extends SchedulableGame>(
  games: readonly T[],
  slotMode: PairingSlotMode,
): T[] {
  return [...games].sort((a, b) =>
    compareVectors(canonicalSortKey(a, slotMode), canonicalSortKey(b, slotMode)),
  );
}

// ── scheduling batch ────────────────────────────────────────────
/**
 * batch key.
 *   none    : Game 하나가 batch 하나
 *   ordered : 동일 session.position
 *   timed   : 동일 starts_at
 */
export function batchKeyOf(g: SchedulableGame, slotMode: PairingSlotMode): string {
  if (slotMode === "timed") return `t${g.sessionStartsAt ?? ""}`;
  if (slotMode === "ordered") return `p${g.sessionPosition ?? 0}`;
  return `g${g.id}`;
}

/** target Game 을 canonical batch 목록으로 묶는다. */
export function buildBatchPlan(
  targets: readonly PairingTargetGameInput[],
  slotMode: PairingSlotMode,
): PairingSchedulingBatch[] {
  const sorted = canonicalSort(targets, slotMode);
  const out: { batchKey: string; targets: PairingTargetGameInput[] }[] = [];
  for (const g of sorted) {
    const k = batchKeyOf(g, slotMode);
    const last = out[out.length - 1];
    if (last !== undefined && last.batchKey === k) last.targets.push(g);
    else out.push({ batchKey: k, targets: [g] });
  }
  return out.map((b) => ({ batchKey: b.batchKey, targets: b.targets }));
}

// ── 충돌 ────────────────────────────────────────────────────────
/**
 * 두 Game 이 실제로 동시에 진행되는가.
 *   ordered : 동일 session.position
 *   none    : Game 하나가 batch 하나라 서로 충돌하지 않는다
 *   timed   : half-open [start,end) pairwise overlap.
 *             경계가 맞닿는 경우(end === start)는 비충돌이다.
 * 시간 정보가 불완전하면(0079 가 이미 거부하지만 방어적으로) starts_at 동일성으로 본다.
 */
export function gamesConflict(
  a: SchedulableGame,
  b: SchedulableGame,
  slotMode: PairingSlotMode,
): boolean {
  if (slotMode === "ordered") return a.sessionPosition === b.sessionPosition;
  if (slotMode === "none") return false;
  const as = parseUtcMs(a.sessionStartsAt);
  const bs = parseUtcMs(b.sessionStartsAt);
  if (as === null || bs === null) return a.sessionStartsAt === b.sessionStartsAt;
  const ae = parseUtcMs(a.sessionEndsAt);
  const be = parseUtcMs(b.sessionEndsAt);
  if (ae === null || be === null) return as === bs;
  return as < be && bs < ae;
}

// ── consecutive / rest gap (ms 정수) ────────────────────────────
/**
 * timed consecutive 판정(C-4B 정본).
 *   requiredRestGapMs > 0 : gap < threshold 면 연속, gap >= threshold 면 reset
 *                           (정확히 같으면 충분히 쉰 것)
 *   requiredRestGapMs = 0 : gap === 0 인 back-to-back 만 연속
 */
export function isConsecutiveGapMs(gapMs: number, requiredRestGapMs: number): boolean {
  return requiredRestGapMs > 0 ? gapMs < requiredRestGapMs : gapMs === 0;
}

/**
 * 이미 배정된 Game 들 중 target 시작 이전에 끝난 것 가운데 가장 늦게 끝난 것과의
 * 실제 gap(ms). 이력이 없으면 null.
 */
export function gapBeforeMs(
  playedGames: readonly SchedulableGame[],
  target: SchedulableGame,
): number | null {
  const tStart = parseUtcMs(target.sessionStartsAt);
  if (tStart === null) return null;
  let lastEnd: number | null = null;
  for (const g of playedGames) {
    const end = parseUtcMs(g.sessionEndsAt) ?? parseUtcMs(g.sessionStartsAt);
    if (end === null || end > tStart) continue;
    if (lastEnd === null || end > lastEnd) lastEnd = end;
  }
  return lastEnd === null ? null : tStart - lastEnd;
}

/** 시간순 정렬(참가자별 출전 이력 계산용). */
export function sortByTime<T extends SchedulableGame>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => {
    const as = parseUtcMs(a.sessionStartsAt) ?? 0;
    const bs = parseUtcMs(b.sessionStartsAt) ?? 0;
    if (as !== bs) return as - bs;
    const ae = parseUtcMs(a.sessionEndsAt) ?? 0;
    const be = parseUtcMs(b.sessionEndsAt) ?? 0;
    if (ae !== be) return ae - be;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** base Game 을 SchedulableGame 으로 좁혀 쓴다(구조가 이미 호환된다). */
export function asSchedulable(g: PairingBaseGameInput | PairingTargetGameInput): SchedulableGame {
  return g;
}
