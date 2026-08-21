/**
 * lib/event-pairing/validate.ts — capture RPC JSON 의 런타임 검증.
 *
 * 의존: types.ts, canonical.ts, scheduling.ts
 *
 * database.types.ts 의 타입만 믿지 않는다. capture schema drift 를 조용히
 * 무시하지 않으려고 unknown key 도 거부한다(v1 정책).
 * 실패 evidence 에는 path 와 issue code 만 담고 값·개인정보·raw snapshot 은 담지 않는다.
 */
import type {
  PairingConfigSnapshotV1,
  PairingEvidence,
  PairingGenderCategory,
  PairingInputSnapshotV1,
  PairingResolvedConfig,
  PairingSlotMode,
} from "./types.ts";
import {
  BEAM_WIDTH,
  CANDIDATE_TOP_K,
  DEFAULT_CONSECUTIVE_GAMES_LIMIT,
  DEFAULT_REPEAT_LIMIT,
  DOUBLES_ONLY,
  LOOKAHEAD_DEPTH,
  PAIRING_ALGORITHM_VERSION,
  POWER_EPSILON_BP,
  SEED_MAX_BYTES,
  TARGET_GAME_MAX,
} from "./types.ts";
import { normalizeSeed } from "./canonical.ts";
import { isCanonicalUtcTimestamp } from "./scheduling.ts";

export interface ValidationFailure {
  readonly ok: false;
  readonly path: string;
  readonly issue: string;
}
export interface ValidationSuccess {
  readonly ok: true;
  readonly config: PairingConfigSnapshotV1;
  readonly input: PairingInputSnapshotV1;
  readonly inputHash: string;
  readonly seed: string;
  readonly resolved: PairingResolvedConfig;
}
export type ValidationResult = ValidationSuccess | ValidationFailure;

const fail = (path: string, issue: string): ValidationFailure => ({ ok: false, path, issue });

export function validationEvidence(f: ValidationFailure): PairingEvidence {
  return { path: f.path, issue: f.issue };
}

// ── 원시 검증 ───────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** UUID 는 lowercase canonical 만 허용한다. */
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const isSafeInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const isNonNegInt = (v: unknown): v is number => isSafeInt(v) && v >= 0;
const isPosInt = (v: unknown): v is number => isSafeInt(v) && v >= 1;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isIntOrNull = (v: unknown): v is number | null => v === null || isSafeInt(v);

function checkExactKeys(obj: Record<string, unknown>, expected: readonly string[], path: string): ValidationFailure | null {
  const actual = Object.keys(obj);
  for (const k of expected) if (!(k in obj)) return fail(`${path}.${k}`, "MISSING_KEY");
  for (const k of actual) if (!expected.includes(k)) return fail(`${path}.${k}`, "UNKNOWN_KEY");
  return null;
}

// ── config ──────────────────────────────────────────────────────
const CONFIG_KEYS: readonly string[] = [
  "version",
  "slot_mode",
  "court_count",
  "rest_gap_minutes",
  "max_games_per_member",
  "partner_repeat_limit",
  "opponent_repeat_limit",
  "consecutive_games_limit",
  "review_required",
  "attendance_enabled",
  "live_queue_enabled",
  "pre_scheduling_enabled",
  "auto_generation_enabled",
  "court_assignment_enabled",
  "participant_confirmation_required",
  "algorithmVersion",
  "powerEpsilonBp",
  "candidateTopK",
  "beamWidth",
  "lookaheadDepth",
  "doublesOnly",
  "calculationYear",
];
const SLOT_MODES: readonly string[] = ["none", "ordered", "timed"];
const CATEGORIES: readonly string[] = ["mens", "womens", "mixed", "open"];
const GENDERS: readonly string[] = ["male", "female", "unspecified"];
const HANDS: readonly string[] = ["right", "left", "unspecified"];
const SOURCES: readonly string[] = ["snapshot", "member", "none"];
const GAME_STATUS: readonly string[] = ["draft", "in_progress", "completed", "cancelled"];
const GAME_SOURCE: readonly string[] = ["manual", "auto"];
const EVENT_STATUS: readonly string[] = ["draft", "active", "completed", "cancelled"];

function validateConfig(raw: unknown): PairingConfigSnapshotV1 | ValidationFailure {
  if (!isPlainObject(raw)) return fail("config", "NOT_OBJECT");
  const keyErr = checkExactKeys(raw, CONFIG_KEYS, "config");
  if (keyErr !== null) return keyErr;

  if (raw.version !== 1) return fail("config.version", "NOT_1");
  if (typeof raw.slot_mode !== "string" || !SLOT_MODES.includes(raw.slot_mode))
    return fail("config.slot_mode", "INVALID_ENUM");
  for (const k of [
    "court_count",
    "rest_gap_minutes",
    "max_games_per_member",
    "partner_repeat_limit",
    "opponent_repeat_limit",
    "consecutive_games_limit",
  ]) {
    const v = raw[k];
    if (!isIntOrNull(v)) return fail(`config.${k}`, "NOT_INTEGER_OR_NULL");
    if (v !== null && v < 0) return fail(`config.${k}`, "NEGATIVE");
  }
  const cgl = raw.consecutive_games_limit;
  if (cgl !== null && (cgl as number) < 1) return fail("config.consecutive_games_limit", "OUT_OF_RANGE");
  for (const k of [
    "review_required",
    "attendance_enabled",
    "live_queue_enabled",
    "pre_scheduling_enabled",
    "auto_generation_enabled",
    "court_assignment_enabled",
    "participant_confirmation_required",
    "doublesOnly",
  ]) {
    if (!isBool(raw[k])) return fail(`config.${k}`, "NOT_BOOLEAN");
  }
  // 자동 대진이 꺼진 Event 는 정상 입력이 아니다. 0079 capture 가 이미
  // AUTO_GENERATION_DISABLED 로 막지만, 엔진도 capture 출력을 그대로 믿지 않는다.
  if (raw.auto_generation_enabled !== true)
    return fail("config.auto_generation_enabled", "NOT_ENABLED");
  if (raw.algorithmVersion !== PAIRING_ALGORITHM_VERSION)
    return fail("config.algorithmVersion", "UNSUPPORTED");
  if (!isSafeInt(raw.calculationYear)) return fail("config.calculationYear", "NOT_INTEGER");
  for (const k of ["powerEpsilonBp", "candidateTopK", "beamWidth", "lookaheadDepth"]) {
    if (!isSafeInt(raw[k])) return fail(`config.${k}`, "NOT_INTEGER");
  }
  return raw as unknown as PairingConfigSnapshotV1;
}

/** v1 알고리즘 상수와 capture config 가 정확히 같은지. */
export function configConstantsMatch(config: PairingConfigSnapshotV1): boolean {
  return (
    config.powerEpsilonBp === POWER_EPSILON_BP &&
    config.candidateTopK === CANDIDATE_TOP_K &&
    config.beamWidth === BEAM_WIDTH &&
    config.lookaheadDepth === LOOKAHEAD_DEPTH &&
    config.doublesOnly === DOUBLES_ONLY
  );
}

/** 원본 null 을 v1 기본값으로 해석한다. 원본은 바꾸지 않는다. */
export function resolveConfig(config: PairingConfigSnapshotV1): PairingResolvedConfig {
  const restMinutes = config.rest_gap_minutes;
  return {
    slotMode: config.slot_mode,
    calculationYear: config.calculationYear,
    consecutiveGamesLimit: config.consecutive_games_limit ?? DEFAULT_CONSECUTIVE_GAMES_LIMIT,
    partnerRepeatLimit: config.partner_repeat_limit ?? DEFAULT_REPEAT_LIMIT,
    opponentRepeatLimit: config.opponent_repeat_limit ?? DEFAULT_REPEAT_LIMIT,
    maxGamesPerMember: config.max_games_per_member,
    requiredRestGapMs: restMinutes === null ? 0 : restMinutes * 60000,
    restGapConfigured: restMinutes !== null,
    powerEpsilonBp: config.powerEpsilonBp,
    candidateTopK: config.candidateTopK,
    beamWidth: config.beamWidth,
    lookaheadDepth: config.lookaheadDepth,
  };
}

// ── input ───────────────────────────────────────────────────────
const INPUT_KEYS: readonly string[] = ["event", "participants", "targetGames", "baseGames"];
const EVENT_KEYS: readonly string[] = ["id", "clubId", "status"];
const PARTICIPANT_KEYS: readonly string[] = [
  "id", "participantType", "memberId", "guestId",
  "gender", "genderSource", "tennisStartYear", "tennisStartYearSource",
  "dominantHand", "dominantHandSource", "mapoScore", "mapoScoreSource",
  "wins", "losses", "draws",
];
const TARGET_KEYS: readonly string[] = [
  "id", "position", "format", "genderCategory", "courtId", "courtPosition",
  "sessionId", "sessionPosition", "sessionStartsAt", "sessionEndsAt",
];
const BASE_KEYS: readonly string[] = [...TARGET_KEYS, "status", "source", "pairingRunId", "lineup"];
const LINEUP_KEYS: readonly string[] = ["participantId", "team", "slot"];

/** 알고리즘에 필요 없는 개인 식별 key 가 섞여 들어오면 즉시 거부한다. */
const PII_KEYS: readonly string[] = [
  "name", "nickname", "phone", "displayName", "display_name_snapshot",
  "memo", "notes", "address", "authUserId", "auth_user_id", "email",
];

function hasPii(obj: Record<string, unknown>, path: string): ValidationFailure | null {
  for (const k of Object.keys(obj)) {
    if (PII_KEYS.includes(k)) return fail(`${path}.${k}`, "PII_KEY_PRESENT");
  }
  return null;
}

function validateTimestampPair(
  o: Record<string, unknown>,
  path: string,
  slotMode: PairingSlotMode,
): ValidationFailure | null {
  const s = o.sessionStartsAt;
  const e = o.sessionEndsAt;
  if (s !== null && !isCanonicalUtcTimestamp(s)) return fail(`${path}.sessionStartsAt`, "NOT_UTC_TIMESTAMP");
  if (e !== null && !isCanonicalUtcTimestamp(e)) return fail(`${path}.sessionEndsAt`, "NOT_UTC_TIMESTAMP");
  if (slotMode === "timed") {
    if (s === null || e === null) return fail(`${path}.sessionStartsAt`, "TIMED_REQUIRES_TIMES");
    if (Date.parse(e as string) <= Date.parse(s as string))
      return fail(`${path}.sessionEndsAt`, "END_NOT_AFTER_START");
  }
  return null;
}

function validateGameCommon(
  o: Record<string, unknown>,
  path: string,
  slotMode: PairingSlotMode,
): ValidationFailure | null {
  if (!isUuid(o.id)) return fail(`${path}.id`, "NOT_UUID");
  if (!isPosInt(o.position)) return fail(`${path}.position`, "NOT_POSITIVE_INTEGER");
  if (o.format !== "singles" && o.format !== "doubles") return fail(`${path}.format`, "INVALID_ENUM");
  if (typeof o.genderCategory !== "string" || !CATEGORIES.includes(o.genderCategory))
    return fail(`${path}.genderCategory`, "INVALID_ENUM");
  if (o.courtId !== null && !isUuid(o.courtId)) return fail(`${path}.courtId`, "NOT_UUID_OR_NULL");
  if (o.sessionId !== null && !isUuid(o.sessionId)) return fail(`${path}.sessionId`, "NOT_UUID_OR_NULL");
  if (o.courtPosition !== null && !isPosInt(o.courtPosition))
    return fail(`${path}.courtPosition`, "NOT_POSITIVE_INTEGER_OR_NULL");
  if (o.sessionPosition !== null && !isPosInt(o.sessionPosition))
    return fail(`${path}.sessionPosition`, "NOT_POSITIVE_INTEGER_OR_NULL");
  if (slotMode === "ordered" && o.sessionPosition === null)
    return fail(`${path}.sessionPosition`, "ORDERED_REQUIRES_SESSION_POSITION");
  return validateTimestampPair(o, path, slotMode);
}

function validateInput(raw: unknown, slotMode: PairingSlotMode): PairingInputSnapshotV1 | ValidationFailure {
  if (!isPlainObject(raw)) return fail("input", "NOT_OBJECT");
  const keyErr = checkExactKeys(raw, INPUT_KEYS, "input");
  if (keyErr !== null) return keyErr;

  // event
  const ev = raw.event;
  if (!isPlainObject(ev)) return fail("input.event", "NOT_OBJECT");
  const evKeyErr = checkExactKeys(ev, EVENT_KEYS, "input.event");
  if (evKeyErr !== null) return evKeyErr;
  if (!isUuid(ev.id)) return fail("input.event.id", "NOT_UUID");
  if (!isUuid(ev.clubId)) return fail("input.event.clubId", "NOT_UUID");
  if (typeof ev.status !== "string" || !EVENT_STATUS.includes(ev.status))
    return fail("input.event.status", "INVALID_ENUM");

  // participants
  if (!Array.isArray(raw.participants)) return fail("input.participants", "NOT_ARRAY");
  const seenParticipant = new Set<string>();
  for (let i = 0; i < raw.participants.length; i++) {
    const p = raw.participants[i];
    const path = `input.participants[${i}]`;
    if (!isPlainObject(p)) return fail(path, "NOT_OBJECT");
    const pii = hasPii(p, path);
    if (pii !== null) return pii;
    const pk = checkExactKeys(p, PARTICIPANT_KEYS, path);
    if (pk !== null) return pk;
    if (!isUuid(p.id)) return fail(`${path}.id`, "NOT_UUID");
    if (seenParticipant.has(p.id)) return fail(`${path}.id`, "DUPLICATE_PARTICIPANT_ID");
    seenParticipant.add(p.id);
    if (p.participantType !== "member" && p.participantType !== "guest")
      return fail(`${path}.participantType`, "INVALID_ENUM");
    const hasMember = p.memberId !== null;
    const hasGuest = p.guestId !== null;
    if (hasMember === hasGuest) return fail(`${path}.memberId`, "MEMBER_GUEST_XOR_VIOLATION");
    if (hasMember && !isUuid(p.memberId)) return fail(`${path}.memberId`, "NOT_UUID");
    if (hasGuest && !isUuid(p.guestId)) return fail(`${path}.guestId`, "NOT_UUID");
    if (hasMember && p.participantType !== "member") return fail(`${path}.participantType`, "TYPE_ID_MISMATCH");
    if (hasGuest && p.participantType !== "guest") return fail(`${path}.participantType`, "TYPE_ID_MISMATCH");
    if (typeof p.gender !== "string" || !GENDERS.includes(p.gender)) return fail(`${path}.gender`, "INVALID_ENUM");
    if (typeof p.dominantHand !== "string" || !HANDS.includes(p.dominantHand))
      return fail(`${path}.dominantHand`, "INVALID_ENUM");
    for (const k of ["genderSource", "tennisStartYearSource", "dominantHandSource", "mapoScoreSource"]) {
      const v = p[k];
      if (typeof v !== "string" || !SOURCES.includes(v)) return fail(`${path}.${k}`, "INVALID_ENUM");
    }
    if (p.tennisStartYear !== null && !isSafeInt(p.tennisStartYear))
      return fail(`${path}.tennisStartYear`, "NOT_INTEGER_OR_NULL");
    if (p.mapoScore !== null) {
      if (!isSafeInt(p.mapoScore)) return fail(`${path}.mapoScore`, "NOT_INTEGER_OR_NULL");
      if ((p.mapoScore as number) < 1 || (p.mapoScore as number) > 10)
        return fail(`${path}.mapoScore`, "OUT_OF_RANGE");
    }
    for (const k of ["wins", "losses", "draws"]) {
      if (!isNonNegInt(p[k])) return fail(`${path}.${k}`, "NOT_NON_NEGATIVE_INTEGER");
    }
  }

  // targetGames
  if (!Array.isArray(raw.targetGames)) return fail("input.targetGames", "NOT_ARRAY");
  if (raw.targetGames.length < 1) return fail("input.targetGames", "EMPTY");
  if (raw.targetGames.length > TARGET_GAME_MAX) return fail("input.targetGames", "LIMIT_EXCEEDED");
  const targetIds = new Set<string>();
  for (let i = 0; i < raw.targetGames.length; i++) {
    const g = raw.targetGames[i];
    const path = `input.targetGames[${i}]`;
    if (!isPlainObject(g)) return fail(path, "NOT_OBJECT");
    const gk = checkExactKeys(g, TARGET_KEYS, path);
    if (gk !== null) return gk;
    const err = validateGameCommon(g, path, slotMode);
    if (err !== null) return err;
    if (g.format !== "doubles") return fail(`${path}.format`, "TARGET_MUST_BE_DOUBLES");
    if (targetIds.has(g.id as string)) return fail(`${path}.id`, "DUPLICATE_TARGET_ID");
    targetIds.add(g.id as string);
  }

  // baseGames
  if (!Array.isArray(raw.baseGames)) return fail("input.baseGames", "NOT_ARRAY");
  const baseIds = new Set<string>();
  for (let i = 0; i < raw.baseGames.length; i++) {
    const g = raw.baseGames[i];
    const path = `input.baseGames[${i}]`;
    if (!isPlainObject(g)) return fail(path, "NOT_OBJECT");
    const gk = checkExactKeys(g, BASE_KEYS, path);
    if (gk !== null) return gk;
    const err = validateGameCommon(g, path, slotMode);
    if (err !== null) return err;
    if (baseIds.has(g.id as string)) return fail(`${path}.id`, "DUPLICATE_BASE_ID");
    if (targetIds.has(g.id as string)) return fail(`${path}.id`, "TARGET_BASE_OVERLAP");
    baseIds.add(g.id as string);
    if (typeof g.status !== "string" || !GAME_STATUS.includes(g.status))
      return fail(`${path}.status`, "INVALID_ENUM");
    if (g.status === "cancelled") return fail(`${path}.status`, "CANCELLED_NOT_ALLOWED");
    if (typeof g.source !== "string" || !GAME_SOURCE.includes(g.source))
      return fail(`${path}.source`, "INVALID_ENUM");
    if (g.pairingRunId !== null && !isUuid(g.pairingRunId))
      return fail(`${path}.pairingRunId`, "NOT_UUID_OR_NULL");

    if (!Array.isArray(g.lineup)) return fail(`${path}.lineup`, "NOT_ARRAY");
    const expected = g.format === "singles" ? 2 : 4;
    if (g.lineup.length !== expected) return fail(`${path}.lineup`, "WRONG_LINEUP_SIZE");
    const seenSlot = new Set<string>();
    const seenPid = new Set<string>();
    for (let j = 0; j < g.lineup.length; j++) {
      const l = g.lineup[j];
      const lpath = `${path}.lineup[${j}]`;
      if (!isPlainObject(l)) return fail(lpath, "NOT_OBJECT");
      const lk = checkExactKeys(l, LINEUP_KEYS, lpath);
      if (lk !== null) return lk;
      if (!isUuid(l.participantId)) return fail(`${lpath}.participantId`, "NOT_UUID");
      if (l.team !== "a" && l.team !== "b") return fail(`${lpath}.team`, "INVALID_ENUM");
      if (!isPosInt(l.slot)) return fail(`${lpath}.slot`, "NOT_POSITIVE_INTEGER");
      const sk = `${l.team}:${l.slot}`;
      if (seenSlot.has(sk)) return fail(`${lpath}.slot`, "DUPLICATE_TEAM_SLOT");
      seenSlot.add(sk);
      if (seenPid.has(l.participantId as string))
        return fail(`${lpath}.participantId`, "DUPLICATE_PARTICIPANT_IN_GAME");
      seenPid.add(l.participantId as string);
    }
  }

  return raw as unknown as PairingInputSnapshotV1;
}

// ── 진입점 ──────────────────────────────────────────────────────
/**
 * capture RPC 출력 + API 입력을 검증하고 resolved config 를 만든다.
 * 실패는 예외가 아니라 ValidationFailure 로 돌려준다.
 */
export function validateRunInput(args: {
  readonly configSnapshot: unknown;
  readonly inputSnapshot: unknown;
  readonly inputHash: unknown;
  readonly seed: unknown;
}): ValidationResult {
  const config = validateConfig(args.configSnapshot);
  if ("ok" in config && config.ok === false) return config;
  const cfg = config as PairingConfigSnapshotV1;

  if (typeof args.inputHash !== "string" || !HASH_RE.test(args.inputHash))
    return fail("inputHash", "NOT_LOWERCASE_SHA256_HEX");

  const seed = normalizeSeed(args.seed, SEED_MAX_BYTES);
  if (!seed.ok) return fail("seed", seed.issue ?? "INVALID");

  const input = validateInput(args.inputSnapshot, cfg.slot_mode);
  if ("ok" in input && (input as ValidationFailure).ok === false) return input as ValidationFailure;
  const inp = input as PairingInputSnapshotV1;

  // lineup 참가자는 eligible pool 밖(withdrawn 등)일 수 있으므로 존재 검사를 하지 않는다.
  // 다만 target 과 base 의 Game ID 교집합은 위에서 이미 거부했다.

  return {
    ok: true,
    config: cfg,
    input: inp,
    inputHash: args.inputHash,
    seed: seed.seed,
    resolved: resolveConfig(cfg),
  };
}

/** genderCategory 를 좁혀 쓰기 위한 헬퍼. */
export function asGenderCategory(v: string): PairingGenderCategory {
  return v as PairingGenderCategory;
}
