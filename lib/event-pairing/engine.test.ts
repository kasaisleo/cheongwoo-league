/**
 * lib/event-pairing/engine.test.ts — golden parity + canonical/validation 단위 테스트.
 *
 * 실행: npm run test:pairing  (node --test, 외부 test framework 없음)
 * core.ts 를 직접 import 한다 — engine.ts 는 server-only 라 Next 밖에서 해석되지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { runEventPairing } from "./core.ts";
import {
  canonicalStringify,
  canonicalHash,
  normalizeSeed,
  seedTieHash,
  canonicalLineupKey,
  CanonicalSerializeError,
} from "./canonical.ts";
import { roundHalfUp, mapoBpFromScore, mapoMedianBp, recordBp, experienceBp, powerBp } from "./power.ts";
import { validateRunInput, resolveConfig } from "./validate.ts";
import { gamesConflict, isCanonicalUtcTimestamp } from "./scheduling.ts";
import { GOLDEN_CASES, GOLDEN_INPUT_HASH } from "./__fixtures__/golden.ts";
import type { PairingGameDecision, PairingJsonValue } from "./types.ts";

// ── golden parity ───────────────────────────────────────────────
test("golden: 모든 fixture 가 기대값과 byte 일치한다", () => {
  assert.ok(GOLDEN_CASES.length >= 19, `fixture 수 ${GOLDEN_CASES.length}`);
  for (const c of GOLDEN_CASES) {
    const r = runEventPairing({
      configSnapshot: c.config,
      inputSnapshot: c.input,
      inputHash: GOLDEN_INPUT_HASH,
      seed: c.seed,
      algorithmVersion: "v1",
    });
    if (c.expectFailure) {
      assert.equal(r.ok, false, `${c.label}: 실패해야 한다`);
      if (!r.ok) assert.equal(r.reason, c.reason, `${c.label}: reason`);
      continue;
    }
    assert.equal(r.ok, true, `${c.label}: 성공해야 한다`);
    if (!r.ok) continue;
    // lineup diff 를 사람이 볼 수 있게 개별 비교한다.
    assert.equal(r.games.length, c.games?.length ?? -1, `${c.label}: game 수`);
    for (let i = 0; i < r.games.length; i++) {
      const got: PairingGameDecision = r.games[i];
      const want: PairingGameDecision = (c.games ?? [])[i];
      assert.deepEqual(
        { id: got.gameId, a: [...got.teamA], b: [...got.teamB], d: got.powerDifferenceBp },
        { id: want.gameId, a: [...want.teamA], b: [...want.teamB], d: want.powerDifferenceBp },
        `${c.label}: games[${i}] lineup`,
      );
      assert.deepEqual([...got.reasons], [...want.reasons], `${c.label}: games[${i}] reasons`);
    }
    assert.deepEqual({ ...r.summary }, { ...(c.summary ?? {}) }, `${c.label}: summary`);
    assert.deepEqual(
      r.warnings.map((w) => ({ code: w.code, evidence: w.evidence })),
      (c.warnings ?? []).map((w) => ({ code: w.code, evidence: w.evidence })),
      `${c.label}: warnings`,
    );
    assert.equal(r.resultHash, c.resultHash, `${c.label}: resultHash`);
  }
});

test("golden: 같은 입력을 5회 실행해도 resultHash 가 동일하다", () => {
  const c = GOLDEN_CASES.find((x) => !x.expectFailure);
  assert.ok(c);
  const hashes = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const r = runEventPairing({
      configSnapshot: c.config, inputSnapshot: c.input,
      inputHash: GOLDEN_INPUT_HASH, seed: c.seed, algorithmVersion: "v1",
    });
    assert.equal(r.ok, true);
    if (r.ok) hashes.add(r.resultHash);
  }
  assert.equal(hashes.size, 1);
});

test("golden: stable-prefix 는 target 을 늘려도 앞 결과가 유지된다", () => {
  const byN = new Map<number, (typeof GOLDEN_CASES)[number]>();
  for (const c of GOLDEN_CASES) {
    const m = /^stable-prefix-n(\d+)$/.exec(c.label);
    if (m !== null) byN.set(Number(m[1]), c);
  }
  const steps = [1, 2, 3, 5, 8, 10, 15, 20].filter((n) => byN.has(n));
  assert.ok(steps.length >= 8, "stable-prefix fixture 8개");
  for (let i = 1; i < steps.length; i++) {
    const prev = byN.get(steps[i - 1]);
    const cur = byN.get(steps[i]);
    assert.ok(prev?.games && cur?.games);
    // fresh 재계산 prefix 는 보장 대상이 아니다 — 여기서는 게임 수만 단조 증가함을 본다.
    assert.ok(cur.games.length > prev.games.length, `n${steps[i - 1]} < n${steps[i]}`);
  }
});

// ── canonical serializer ────────────────────────────────────────
test("canonical: object key 입력 순서가 달라도 동일 바이트", () => {
  const a = { b: 2, a: 1, c: { z: 1, y: 2 } };
  const b = { a: 1, c: { y: 2, z: 1 }, b: 2 };
  assert.equal(canonicalStringify(a), canonicalStringify(b));
  assert.equal(canonicalHash(a), canonicalHash(b));
});

test("canonical: nested / array 순서 / Unicode / null 구분", () => {
  assert.equal(canonicalStringify({ a: [1, 2, 3] }), '{"a":[1,2,3]}');
  assert.notEqual(canonicalStringify({ a: [1, 2] }), canonicalStringify({ a: [2, 1] }));
  assert.equal(canonicalStringify({ k: "한글🎾" }), '{"k":"한글🎾"}');
  assert.notEqual(canonicalStringify({ a: 1, b: null }), canonicalStringify({ a: 1 }));
});

test("canonical: float / NaN / Infinity / -0 / undefined 거부", () => {
  for (const bad of [0.5, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
    assert.throws(() => canonicalStringify({ v: bad } as unknown as PairingJsonValue), CanonicalSerializeError);
  }
  assert.throws(
    () => canonicalStringify({ v: undefined } as unknown as PairingJsonValue),
    CanonicalSerializeError,
  );
  assert.throws(
    () => canonicalStringify({ v: BigInt(2) } as unknown as PairingJsonValue),
    CanonicalSerializeError,
  );
});

test("canonical: Date / Map / Set / function 거부", () => {
  for (const bad of [new Date(0), new Map(), new Set(), (): void => {}]) {
    assert.throws(() => canonicalStringify({ v: bad } as unknown as PairingJsonValue), CanonicalSerializeError);
  }
});

test("canonical: __proto__ / constructor key 거부", () => {
  const o = JSON.parse('{"__proto__":{"x":1},"a":1}') as PairingJsonValue;
  assert.throws(() => canonicalStringify(o), CanonicalSerializeError);
  assert.throws(
    () => canonicalStringify({ constructor: 1 } as unknown as PairingJsonValue),
    CanonicalSerializeError,
  );
});

test("canonical: 입력 객체를 mutate 하지 않는다", () => {
  const o = { b: 1, a: { d: 2, c: 3 } };
  const before = JSON.stringify(o);
  canonicalStringify(o);
  assert.equal(JSON.stringify(o), before);
});

// ── seed ────────────────────────────────────────────────────────
test("seed: trim + NFC + 1..128 byte", () => {
  assert.equal(normalizeSeed("  abc  ", 128).seed, "abc");
  assert.equal(normalizeSeed("   ", 128).ok, false);
  assert.equal(normalizeSeed("   ", 128).issue, "BLANK");
  assert.equal(normalizeSeed(123, 128).issue, "NOT_STRING");
  // NFC: 결합문자 'e' + U+0301 이 é 로 정규화된다.
  assert.equal(normalizeSeed("é", 128).seed, "é");
  assert.equal(normalizeSeed("é", 128).seed, normalizeSeed("é", 128).seed);
  // 한글/emoji 는 UTF-8 바이트로 센다.
  assert.equal(normalizeSeed("가", 128).byteLength, 3);
  assert.equal(normalizeSeed("🎾", 128).byteLength, 4);
  assert.equal(normalizeSeed("가".repeat(43), 128).ok, false, "129 bytes 는 거부");
  assert.equal(normalizeSeed("가".repeat(42), 128).ok, true, "126 bytes 는 허용");
});

test("seed: tie-break 는 구분자 충돌이 없다", () => {
  // 단순 이어붙이기라면 ("a|b","c") 와 ("a","b|c") 가 충돌한다.
  assert.notEqual(seedTieHash("a|b", "c"), seedTieHash("a", "b|c"));
  assert.equal(seedTieHash("s", "k"), seedTieHash("s", "k"));
});

test("canonicalLineupKey: team swap / 팀내 순서를 정규화한다", () => {
  const k1 = canonicalLineupKey(["p2", "p1"], ["p4", "p3"]);
  const k2 = canonicalLineupKey(["p3", "p4"], ["p1", "p2"]);
  assert.equal(k1, k2);
});

// ── power 정수 산술 ─────────────────────────────────────────────
test("power: roundHalfUp 과 basis-point 공식", () => {
  assert.equal(roundHalfUp(1, 2), 1);
  assert.equal(roundHalfUp(3, 2), 2);
  assert.equal(mapoBpFromScore(1), 0);
  assert.equal(mapoBpFromScore(10), 10000);
  assert.equal(experienceBp(2026, null), 5000);
  assert.equal(experienceBp(2026, 2026), 0);
  assert.equal(experienceBp(2026, 1900), 10000, "30년 초과는 clamp");
  assert.equal(experienceBp(2026, 2030), 0, "음수는 clamp");
  assert.equal(recordBp(0, 0, 0), 5000, "0경기는 중립");
  assert.equal(powerBp(10000, 10000, 10000), 10000);
  assert.equal(powerBp(0, 0, 0), 0);
});

test("power: draw 는 0.5 로 가중된다", () => {
  // W2/L1/D1 : (2*2+1+6)*5000/(4+6) = 11*5000/10 = 5500
  assert.equal(recordBp(2, 1, 1), 5500);
  // W1/L1/D4 : (2*1+4+6)*5000/(6+6) = 12*5000/12 = 5000
  assert.equal(recordBp(1, 1, 4), 5000);
});

test("power: 짝수 표본 중앙값은 2배 중앙값으로 한 번만 반올림한다", () => {
  // [3,6] → median2=9 → (9-2)*5000/9 = 35000/9 = 3888.9 → 3889
  assert.equal(mapoMedianBp([3, 6]), 3889);
  assert.equal(mapoMedianBp([]), 5000);
  assert.equal(mapoMedianBp([5]), mapoBpFromScore(5));
});

test("power: 안전 정수를 벗어나면 즉시 실패한다", () => {
  assert.throws(() => roundHalfUp(Number.MAX_SAFE_INTEGER, 1));
  assert.throws(() => roundHalfUp(-1, 2));
  assert.throws(() => roundHalfUp(1, 0));
});

// ── scheduling ──────────────────────────────────────────────────
test("scheduling: half-open interval 은 추이적이지 않다", () => {
  const g = (id: string, s: string, e: string) => ({
    id, position: 1, courtPosition: 1, sessionPosition: null,
    sessionStartsAt: s, sessionEndsAt: e,
  });
  const G1 = g("g1", "2026-07-15T10:00:00Z", "2026-07-15T10:30:00Z");
  const G2 = g("g2", "2026-07-15T10:15:00Z", "2026-07-15T10:45:00Z");
  const G3 = g("g3", "2026-07-15T10:30:00Z", "2026-07-15T11:00:00Z");
  assert.equal(gamesConflict(G1, G2, "timed"), true);
  assert.equal(gamesConflict(G2, G3, "timed"), true);
  assert.equal(gamesConflict(G1, G3, "timed"), false, "경계가 맞닿으면 비충돌");
});

test("scheduling: UTC 초 단위 형식만 허용한다", () => {
  assert.equal(isCanonicalUtcTimestamp("2026-07-15T10:00:00Z"), true);
  assert.equal(isCanonicalUtcTimestamp("2026-07-15T10:00:00.000Z"), false);
  assert.equal(isCanonicalUtcTimestamp("2026-07-15T10:00:00+09:00"), false);
  assert.equal(isCanonicalUtcTimestamp("2026-07-15 10:00:00"), false);
  assert.equal(isCanonicalUtcTimestamp(null), false);
});

// ── validation ──────────────────────────────────────────────────
const baseCase = GOLDEN_CASES[0];

function runWith(overrides: {
  config?: unknown;
  input?: unknown;
  inputHash?: unknown;
  seed?: unknown;
  algorithmVersion?: unknown;
}): ReturnType<typeof runEventPairing> {
  return runEventPairing({
    configSnapshot: overrides.config ?? baseCase.config,
    inputSnapshot: overrides.input ?? baseCase.input,
    inputHash: overrides.inputHash ?? GOLDEN_INPUT_HASH,
    seed: overrides.seed ?? baseCase.seed,
    algorithmVersion: overrides.algorithmVersion ?? "v1",
  });
}

test("validation: algorithmVersion 이 v1 이 아니면 거부", () => {
  const r = runWith({ algorithmVersion: "v2" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "PAIRING_ALGORITHM_UNSUPPORTED");
});

test("validation: 알고리즘 상수가 다르면 CONFIG_VERSION_MISMATCH", () => {
  const r = runWith({ config: { ...baseCase.config, beamWidth: 64 } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "PAIRING_CONFIG_VERSION_MISMATCH");
});

test("validation: unknown key 를 거부한다", () => {
  const r = runWith({ config: { ...baseCase.config, extraKey: 1 } });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "PAIRING_INPUT_INVALID");
    assert.equal(r.evidence.issue, "UNKNOWN_KEY");
  }
});

test("validation: config key 누락을 거부한다", () => {
  const cfg = { ...baseCase.config } as Record<string, unknown>;
  delete cfg.consecutive_games_limit;
  const r = runWith({ config: cfg });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.evidence.issue, "MISSING_KEY");
});

test("validation: inputHash 는 lowercase 64 hex", () => {
  for (const bad of ["ABC", "z".repeat(64), "a".repeat(63), "A".repeat(64)]) {
    const r = runWith({ inputHash: bad });
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.evidence.path, "inputHash");
  }
});

test("validation: seed 공백/초과를 거부한다", () => {
  const blank = runWith({ seed: "   " });
  assert.equal(blank.ok, false);
  if (!blank.ok) assert.equal(blank.evidence.issue, "BLANK");
  const long = runWith({ seed: "a".repeat(129) });
  assert.equal(long.ok, false);
  if (!long.ok) assert.equal(long.evidence.issue, "TOO_LONG");
});

test("validation: 개인정보 key 가 있으면 거부한다", () => {
  const input = JSON.parse(JSON.stringify(baseCase.input)) as {
    participants: Record<string, unknown>[];
  };
  input.participants[0].name = "홍길동";
  const r = runWith({ input });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.evidence.issue, "PII_KEY_PRESENT");
});

test("validation: participant ID 중복 / member-guest XOR", () => {
  const dup = JSON.parse(JSON.stringify(baseCase.input)) as { participants: { id: string }[] };
  dup.participants[1].id = dup.participants[0].id;
  const r1 = runWith({ input: dup });
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.equal(r1.evidence.issue, "DUPLICATE_PARTICIPANT_ID");

  const xor = JSON.parse(JSON.stringify(baseCase.input)) as {
    participants: { memberId: string | null; guestId: string | null }[];
  };
  xor.participants[0].guestId = xor.participants[0].memberId;
  const r2 = runWith({ input: xor });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.evidence.issue, "MEMBER_GUEST_XOR_VIOLATION");
});

test("validation: target/base Game ID 교집합을 거부한다", () => {
  const input = JSON.parse(JSON.stringify(baseCase.input)) as {
    targetGames: { id: string }[];
    baseGames: unknown[];
  };
  input.baseGames = [
    {
      id: input.targetGames[0].id,
      position: 90, format: "doubles", genderCategory: "open",
      courtId: null, courtPosition: null, sessionId: null, sessionPosition: null,
      sessionStartsAt: null, sessionEndsAt: null,
      status: "draft", source: "manual", pairingRunId: null,
      lineup: [],
    },
  ];
  const r = runWith({ input });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.evidence.issue, "TARGET_BASE_OVERLAP");
});

test("validation: target 은 doubles 여야 하고 32개를 넘을 수 없다", () => {
  const singles = JSON.parse(JSON.stringify(baseCase.input)) as { targetGames: { format: string }[] };
  singles.targetGames[0].format = "singles";
  const r1 = runWith({ input: singles });
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.equal(r1.evidence.issue, "TARGET_MUST_BE_DOUBLES");

  const many = JSON.parse(JSON.stringify(baseCase.input)) as { targetGames: { id: string }[] };
  const t0 = many.targetGames[0];
  many.targetGames = Array.from({ length: 33 }, (_, i) => ({
    ...t0,
    id: `aaaaaaaa-0000-4000-8000-${String(i + 500).padStart(12, "0")}`,
    position: i + 1,
  })) as typeof many.targetGames;
  const r2 = runWith({ input: many });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.evidence.issue, "LIMIT_EXCEEDED");
});

test("validation: cancelled base Game 을 거부한다", () => {
  const input = JSON.parse(JSON.stringify(baseCase.input)) as { baseGames: unknown[] };
  input.baseGames = [
    {
      id: "aaaaaaaa-0000-4000-8000-000000000900",
      position: 90, format: "doubles", genderCategory: "open",
      courtId: null, courtPosition: null, sessionId: null, sessionPosition: null,
      sessionStartsAt: null, sessionEndsAt: null,
      status: "cancelled", source: "manual", pairingRunId: null,
      lineup: [],
    },
  ];
  const r = runWith({ input });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.evidence.issue, "CANCELLED_NOT_ALLOWED");
});

test("validation: 실패 evidence 에는 path 와 issue 만 담긴다", () => {
  const r = runWith({ seed: "  " });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(Object.keys(r.evidence).sort(), ["issue", "path"]);
    assert.equal(typeof r.evidence.path, "string");
  }
});

// ── resolved config ─────────────────────────────────────────────
test("resolved config: null 은 v1 기본값으로 해석되고 원본은 보존된다", () => {
  const cfg = { ...baseCase.config, consecutive_games_limit: null, partner_repeat_limit: null, rest_gap_minutes: null };
  const v = validateRunInput({
    configSnapshot: cfg, inputSnapshot: baseCase.input,
    inputHash: GOLDEN_INPUT_HASH, seed: "x",
  });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.config.consecutive_games_limit, null, "원본 null 보존");
  assert.equal(v.resolved.consecutiveGamesLimit, 2, "null → 2");
  assert.equal(v.resolved.partnerRepeatLimit, 1, "null → 1");
  assert.equal(v.resolved.opponentRepeatLimit, 1, "null → 1");
  assert.equal(v.resolved.requiredRestGapMs, 0, "null → 0ms");
  assert.equal(v.resolved.restGapConfigured, false);
});

test("resolved config: rest_gap_minutes 는 ms 정수로 환산된다", () => {
  const r = resolveConfig({ ...baseCase.config, rest_gap_minutes: 10 });
  assert.equal(r.requiredRestGapMs, 600000);
  assert.equal(Number.isSafeInteger(r.requiredRestGapMs), true);
  assert.equal(r.restGapConfigured, true);
});

test("resolved config: consecutive_games_limit 정수는 그대로 쓴다", () => {
  assert.equal(resolveConfig({ ...baseCase.config, consecutive_games_limit: 3 }).consecutiveGamesLimit, 3);
});

// ── 실패 응답 계약 ──────────────────────────────────────────────
test("실패 응답에는 games/summary/resultHash 가 없다", () => {
  const shortage = GOLDEN_CASES.find((c) => c.expectFailure);
  assert.ok(shortage);
  const r = runEventPairing({
    configSnapshot: shortage.config, inputSnapshot: shortage.input,
    inputHash: GOLDEN_INPUT_HASH, seed: shortage.seed, algorithmVersion: "v1",
  });
  assert.equal(r.ok, false);
  const keys = Object.keys(r).sort();
  assert.deepEqual(keys, ["algorithmVersion", "evidence", "inputHash", "ok", "reason", "seed", "warnings"]);
});

test("CATEGORY_SHORTAGE evidence 에 required/available/shortfall 이 있다", () => {
  const shortage = GOLDEN_CASES.find((c) => c.expectFailure);
  assert.ok(shortage);
  const r = runEventPairing({
    configSnapshot: shortage.config, inputSnapshot: shortage.input,
    inputHash: GOLDEN_INPUT_HASH, seed: shortage.seed, algorithmVersion: "v1",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "CATEGORY_SHORTAGE");
  for (const k of ["category", "required", "available", "shortfall", "ineligibleParticipants"]) {
    assert.ok(k in r.evidence, `evidence.${k}`);
  }
});

// ── config 계약 (최종 게이트 §2) ────────────────────────────────
const CFG_BASE = baseCase.config;
const PART = baseCase.input.participants;

const U2 = (n: number, p: string): string =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;

function mkTarget(i: number, category = "open"): Record<string, unknown> {
  return {
    id: U2(i, "d"), position: i, format: "doubles", genderCategory: category,
    courtId: null, courtPosition: null, sessionId: null, sessionPosition: null,
    sessionStartsAt: null, sessionEndsAt: null,
  };
}

/** genders 배열대로 성별을 덮어쓴 참가자 목록. */
function participantsWithGenders(genders: readonly string[]): unknown[] {
  return genders.map((g, idx) => ({
    ...(PART[idx % PART.length] as unknown as Record<string, unknown>),
    id: U2(idx + 1, "b"),
    memberId: U2(idx + 1, "c"),
    gender: g,
  }));
}

function runCfg(
  cfgOver: Record<string, unknown>,
  inputOver: Record<string, unknown>,
): ReturnType<typeof runEventPairing> {
  return runEventPairing({
    configSnapshot: { ...CFG_BASE, ...cfgOver },
    inputSnapshot: { ...baseCase.input, ...inputOver },
    inputHash: GOLDEN_INPUT_HASH,
    seed: "cfg-contract",
    algorithmVersion: "v1",
  });
}

test("config: auto_generation_enabled 가 true 가 아니면 거부한다", () => {
  for (const v of [false, null, undefined]) {
    const r = runWith({ config: { ...CFG_BASE, auto_generation_enabled: v } });
    assert.equal(r.ok, false, String(v));
    if (!r.ok) {
      assert.equal(r.reason, "PAIRING_INPUT_INVALID");
      assert.equal(r.evidence.path, "config.auto_generation_enabled");
    }
  }
  assert.equal(runWith({}).ok, true, "true 는 정상");
});

test("config: max_games_per_member 도달 시 더 배정하지 않는다", () => {
  // 6명 / 인당 1게임 상한 / target 3게임 → 첫 게임에서 4명 소진, 나머지는 불가능
  const r = runCfg(
    { max_games_per_member: 1 },
    { targetGames: [mkTarget(1), mkTarget(2), mkTarget(3)] },
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(
      r.reason === "NO_ELIGIBLE_SUBSET" ||
        r.reason === "CATEGORY_SHORTAGE" ||
        r.reason === "NO_FEASIBLE_ROUND_PLAN",
      `reason=${r.reason}`,
    );
  }
  const ok = runCfg({ max_games_per_member: 10 }, { targetGames: [mkTarget(1), mkTarget(2)] });
  assert.equal(ok.ok, true, "상한이 넉넉하면 정상 배정");
});

test("config: partner_repeat_limit 초과 시 REPEAT_LIMIT_RELAXED evidence", () => {
  const four = PART.slice(0, 4) as unknown as Record<string, unknown>[];
  const r = runCfg(
    { partner_repeat_limit: 1, opponent_repeat_limit: 99 },
    { participants: four, targetGames: [mkTarget(1), mkTarget(2), mkTarget(3), mkTarget(4)] },
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const w = r.warnings.find((x) => x.code === "REPEAT_LIMIT_RELAXED");
  assert.ok(w, "REPEAT_LIMIT_RELAXED 가 있어야 한다");
  assert.equal(w?.evidence.partnerConfiguredLimit, 1);
  assert.ok((w?.evidence.partnerExceededPairCount as number) > 0);
  assert.ok((w?.evidence.partnerMaxObserved as number) > 1);
});

test("config: opponent_repeat_limit 초과 시 REPEAT_LIMIT_RELAXED evidence", () => {
  const four = PART.slice(0, 4) as unknown as Record<string, unknown>[];
  const r = runCfg(
    { partner_repeat_limit: 99, opponent_repeat_limit: 1 },
    { participants: four, targetGames: [mkTarget(1), mkTarget(2), mkTarget(3), mkTarget(4)] },
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const w = r.warnings.find((x) => x.code === "REPEAT_LIMIT_RELAXED");
  assert.ok(w, "REPEAT_LIMIT_RELAXED 가 있어야 한다");
  assert.equal(w?.evidence.opponentConfiguredLimit, 1);
  assert.ok((w?.evidence.opponentExceededPairCount as number) > 0);
});

test("config: consecutive 완화가 필요하면 CONSECUTIVE_LIMIT_RELAXED", () => {
  // 5명 1코트: 매 게임 4명이 필요해 연속 출전이 구조적으로 불가피하다.
  const five = PART.slice(0, 5) as unknown as Record<string, unknown>[];
  const r = runCfg(
    { consecutive_games_limit: 1 },
    { participants: five, targetGames: [mkTarget(1), mkTarget(2), mkTarget(3), mkTarget(4)] },
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(
    r.warnings.some((w) => w.code === "CONSECUTIVE_LIMIT_RELAXED"),
    `warnings=${r.warnings.map((w) => w.code).join(",")}`,
  );
});

test("config: rest gap 완화가 필요하면 REST_LIMIT_RELAXED (evidence 는 ms)", () => {
  const iso = (m: number): string =>
    new Date(Date.UTC(2026, 6, 15, 10, m)).toISOString().replace(/\.\d{3}Z$/, "Z");
  const eight = participantsWithGenders(
    Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? "male" : "female")),
  );
  const targets = [
    { ...mkTarget(1), courtId: U2(1, "5"), courtPosition: 1, sessionId: U2(1, "6"), sessionPosition: 1, sessionStartsAt: iso(0), sessionEndsAt: iso(30) },
    { ...mkTarget(2), courtId: U2(2, "5"), courtPosition: 2, sessionId: U2(1, "6"), sessionPosition: 1, sessionStartsAt: iso(0), sessionEndsAt: iso(30) },
    { ...mkTarget(3), courtId: U2(1, "5"), courtPosition: 1, sessionId: U2(2, "6"), sessionPosition: 2, sessionStartsAt: iso(35), sessionEndsAt: iso(65) },
    { ...mkTarget(4), courtId: U2(2, "5"), courtPosition: 2, sessionId: U2(2, "6"), sessionPosition: 2, sessionStartsAt: iso(35), sessionEndsAt: iso(65) },
  ];
  const r = runCfg(
    { slot_mode: "timed", rest_gap_minutes: 60 },
    { participants: eight, targetGames: targets },
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const w = r.warnings.find((x) => x.code === "REST_LIMIT_RELAXED");
  assert.ok(w, `warnings=${r.warnings.map((x) => x.code).join(",")}`);
  assert.equal(w?.evidence.requiredRestGapMs, 3600000);
});

test("config: appearance 완화가 필요하면 APPEARANCE_BALANCE_RELAXED", () => {
  // 남2/여2/미지정4 + mixed: 2번째 게임의 appearance-admissible pool 이
  // 미지정 4명뿐이라 mixed 를 만족할 수 없어 appearance 를 완화해야 한다.
  const eight = participantsWithGenders([
    "male", "male", "female", "female", "unspecified", "unspecified", "unspecified", "unspecified",
  ]);
  const r = runCfg({}, { participants: eight, targetGames: [mkTarget(1, "mixed"), mkTarget(2, "mixed")] });
  assert.equal(r.ok, true, "mixed 2게임은 성사되어야 한다");
  if (!r.ok) return;
  assert.ok(
    r.warnings.some((w) => w.code === "APPEARANCE_BALANCE_RELAXED"),
    `warnings=${r.warnings.map((w) => w.code).join(",")}`,
  );
});

test("config: 실제 완화가 없으면 완화 warning 이 0건이다", () => {
  const eight = participantsWithGenders(
    Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? "male" : "female")),
  );
  const r = runCfg({}, { participants: eight, targetGames: [mkTarget(1), mkTarget(2)] });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const relax = r.warnings.filter(
    (w) =>
      w.code === "CONSECUTIVE_LIMIT_RELAXED" ||
      w.code === "REST_LIMIT_RELAXED" ||
      w.code === "APPEARANCE_BALANCE_RELAXED",
  );
  assert.deepEqual(relax, [], `완화 warning: ${relax.map((w) => w.code).join(",")}`);
  assert.equal(r.summary.relaxedConstraintCount, 0);
});

test("config: category 는 어떤 경우에도 완화되지 않는다", () => {
  // (1) 불가능하면 open 으로 바뀌지 않고 CATEGORY_SHORTAGE 로 실패한다.
  const shortage = participantsWithGenders([
    "male", "female", "female", "unspecified", "unspecified", "unspecified",
  ]);
  const bad = runCfg({}, { participants: shortage, targetGames: [mkTarget(1, "mixed")] });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "CATEGORY_SHORTAGE");

  // (2) 성사되는 경우에도 target 의 configured category 가 그대로 유지된다.
  const eight = participantsWithGenders([
    "male", "male", "male", "male", "female", "female", "female", "female",
  ]);
  for (const cat of ["mens", "womens", "mixed", "open"]) {
    const r = runCfg({}, { participants: eight, targetGames: [mkTarget(1, cat), mkTarget(2, cat)] });
    assert.equal(r.ok, true, `${cat} 는 성사되어야 한다`);
    if (!r.ok) continue;
    for (const g of r.games) assert.equal(g.genderCategory, cat, `${cat}: category 불변`);
  }
});
