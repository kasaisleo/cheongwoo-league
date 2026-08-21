/**
 * lib/event-pairing/property.test.ts — property / 품질 / 성능.
 *
 * 실행: npm run test:pairing
 * 성능 테스트는 느린 CI 에서 flaky 해지지 않도록 PAIRING_PERF=1 일 때만 임계값을
 * 강제하고, 기본 실행에서는 측정치만 기록한다(정확성 검증은 항상 수행).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { runEventPairing } from "./core.ts";
import { gamesConflict } from "./scheduling.ts";
import type {
  PairingConfigSnapshotV1,
  PairingGenderCategory,
  PairingInputSnapshotV1,
  PairingParticipantInput,
  PairingPreviewSuccess,
  PairingSlotMode,
  PairingTargetGameInput,
} from "./types.ts";

// ── fixture 생성기 ──────────────────────────────────────────────
const U = (n: number, p: string): string =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const INPUT_HASH = "0".repeat(63) + "1";

function mkConfig(over: Partial<PairingConfigSnapshotV1> = {}): PairingConfigSnapshotV1 {
  return {
    version: 1, slot_mode: "none", court_count: null, rest_gap_minutes: null,
    max_games_per_member: null, partner_repeat_limit: null, opponent_repeat_limit: null,
    consecutive_games_limit: null, review_required: false, attendance_enabled: false,
    live_queue_enabled: false, pre_scheduling_enabled: false, auto_generation_enabled: true,
    court_assignment_enabled: false, participant_confirmation_required: false,
    algorithmVersion: "v1", powerEpsilonBp: 2000, candidateTopK: 8, beamWidth: 32,
    lookaheadDepth: 2, doublesOnly: true, calculationYear: 2026, ...over,
  };
}

function mkParticipants(n: number): PairingParticipantInput[] {
  return Array.from({ length: n }, (_, idx) => {
    const i = idx + 1;
    return {
      id: U(i, "b"), participantType: "member" as const, memberId: U(i, "c"), guestId: null,
      gender: (i % 2 === 1 ? "male" : "female") as PairingParticipantInput["gender"],
      genderSource: "member" as const,
      tennisStartYear: 2000 + ((i - 1) % 15), tennisStartYearSource: "member" as const,
      dominantHand: ((i - 1) % 4 === 0 ? "left" : "right") as PairingParticipantInput["dominantHand"],
      dominantHandSource: "member" as const,
      mapoScore: ((i - 1) % 9) + 1, mapoScoreSource: "member" as const,
      wins: (i - 1) % 5, losses: (n - i) % 5, draws: (i - 1) % 6 === 0 ? 1 : 0,
    };
  });
}

const isoUtc = (minutes: number): string =>
  new Date(Date.UTC(2026, 6, 15, 10, minutes)).toISOString().replace(/\.\d{3}Z$/, "Z");

function mkTargets(opts: {
  count: number; courts?: number; slotMode?: PairingSlotMode;
  category?: PairingGenderCategory; durationMin?: number; stepMin?: number;
}): PairingTargetGameInput[] {
  const { count, courts = 1, slotMode = "none", category = "open", durationMin = 30, stepMin = 30 } = opts;
  const out: PairingTargetGameInput[] = [];
  let pos = 1;
  const batches = Math.ceil(count / courts);
  for (let b = 1; b <= batches && out.length < count; b++) {
    for (let c = 1; c <= courts && out.length < count; c++) {
      const startMin = (b - 1) * stepMin;
      out.push({
        id: U(pos, "d"), position: pos, format: "doubles", genderCategory: category,
        courtId: slotMode === "none" ? null : U(c, "5"),
        courtPosition: slotMode === "none" ? null : c,
        sessionId: slotMode === "none" ? null : U(b, "6"),
        sessionPosition: slotMode === "none" ? null : b,
        sessionStartsAt: slotMode === "timed" ? isoUtc(startMin) : null,
        sessionEndsAt: slotMode === "timed" ? isoUtc(startMin + durationMin) : null,
      });
      pos++;
    }
  }
  return out;
}

function mkInput(
  participants: readonly PairingParticipantInput[],
  targetGames: readonly PairingTargetGameInput[],
): PairingInputSnapshotV1 {
  return {
    event: { id: U(1, "e"), clubId: U(2, "e"), status: "active" },
    participants, targetGames, baseGames: [],
  };
}

function run(
  config: PairingConfigSnapshotV1,
  input: PairingInputSnapshotV1,
  seed: string,
): ReturnType<typeof runEventPairing> {
  return runEventPairing({
    configSnapshot: config, inputSnapshot: input,
    inputHash: INPUT_HASH, seed, algorithmVersion: "v1",
  });
}

// ── property 축 ─────────────────────────────────────────────────
const COUNTS = [4, 5, 6, 7, 8, 10, 12, 16];
const CATEGORIES: PairingGenderCategory[] = ["mens", "womens", "mixed", "open"];
const SLOTS: { slotMode: PairingSlotMode; courts: number; dur: number; step: number; label: string }[] = [
  { slotMode: "none", courts: 1, dur: 30, step: 30, label: "none1" },
  { slotMode: "ordered", courts: 2, dur: 30, step: 30, label: "ordered2" },
  { slotMode: "ordered", courts: 3, dur: 30, step: 30, label: "ordered3" },
  { slotMode: "timed", courts: 2, dur: 30, step: 30, label: "timed2" },
  { slotMode: "timed", courts: 3, dur: 30, step: 30, label: "timed3" },
  { slotMode: "timed", courts: 2, dur: 45, step: 30, label: "timed-overlap" },
];
const SEEDS = ["prop-1", "prop-2", "prop-3"];

test("property: hard constraint 위반 0 (참가자 x category x slot x seed)", () => {
  let scenarios = 0;
  let violations = 0;
  const failures: string[] = [];

  for (const n of COUNTS) {
    for (const category of CATEGORIES) {
      for (const s of SLOTS) {
        for (const seed of SEEDS) {
          scenarios++;
          const participants = mkParticipants(n);
          const count = Math.min(12, n * 2);
          const targets = mkTargets({
            count, courts: s.courts, slotMode: s.slotMode, category,
            durationMin: s.dur, stepMin: s.step,
          });
          const cfg = mkConfig({ slot_mode: s.slotMode });
          const r = run(cfg, mkInput(participants, targets), seed);
          if (!r.ok) continue; // 인원 부족 등은 실패가 정상이다

          const genderOf = new Map(participants.map((p) => [p.id, p.gender]));
          const byId = new Map(targets.map((t) => [t.id, t]));
          let v = 0;

          for (const g of r.games) {
            // Game 내부 중복
            if (new Set([...g.teamA, ...g.teamB]).size !== 4) v++;
            // configured category 불변 + category 준수
            const t = byId.get(g.gameId);
            if (t === undefined || t.genderCategory !== g.genderCategory) v++;
            const m = (team: readonly string[]): number =>
              team.filter((id) => genderOf.get(id) === "male").length;
            const f = (team: readonly string[]): number =>
              team.filter((id) => genderOf.get(id) === "female").length;
            if (category === "mens" && (m(g.teamA) !== 2 || m(g.teamB) !== 2)) v++;
            if (category === "womens" && (f(g.teamA) !== 2 || f(g.teamB) !== 2)) v++;
            if (category === "mixed" && !(m(g.teamA) === 1 && f(g.teamA) === 1 && m(g.teamB) === 1 && f(g.teamB) === 1)) v++;
          }

          // 실제 interval overlap 중복
          for (let i = 0; i < r.games.length; i++) {
            for (let j = i + 1; j < r.games.length; j++) {
              const gi = byId.get(r.games[i].gameId);
              const gj = byId.get(r.games[j].gameId);
              if (gi === undefined || gj === undefined) continue;
              if (!gamesConflict(gi, gj, s.slotMode)) continue;
              const a = new Set([...r.games[i].teamA, ...r.games[i].teamB]);
              if ([...r.games[j].teamA, ...r.games[j].teamB].some((x) => a.has(x))) v++;
            }
          }

          if (v > 0) {
            violations += v;
            failures.push(`n=${n} ${category} ${s.label} ${seed}: ${v}건`);
          }
        }
      }
    }
  }
  assert.ok(scenarios >= 500, `시나리오 수 ${scenarios}`);
  assert.equal(violations, 0, `위반: ${failures.slice(0, 5).join(" / ")}`);
});

test("property: 동일 seed 는 byte-identical, Court 입력 역순도 동일", () => {
  for (const s of SLOTS) {
    const participants = mkParticipants(12);
    const targets = mkTargets({
      count: 12, courts: s.courts, slotMode: s.slotMode, durationMin: s.dur, stepMin: s.step,
    });
    const cfg = mkConfig({ slot_mode: s.slotMode });
    const a = run(cfg, mkInput(participants, targets), "det-seed");
    const b = run(cfg, mkInput(participants, targets), "det-seed");
    const rev = run(cfg, mkInput(participants, [...targets].reverse()), "det-seed");

    // 겹치는 구간이 많으면 인원 부족으로 infeasible 인 것이 정상이다
    // (timed-overlap: dur 45 > step 30 이라 직전 batch 전원이 충돌한다).
    // 성공이든 실패든 "같은 입력이면 같은 결과" 만 요구한다.
    assert.equal(a.ok, b.ok, `${s.label}: 반복 실행 ok`);
    assert.equal(a.ok, rev.ok, `${s.label}: Court 역순 ok`);
    if (a.ok && b.ok && rev.ok) {
      assert.equal(a.resultHash, b.resultHash, `${s.label}: 반복 실행 resultHash`);
      assert.equal(rev.resultHash, a.resultHash, `${s.label}: Court 입력 역순 resultHash`);
    } else if (!a.ok && !b.ok && !rev.ok) {
      assert.equal(a.reason, b.reason, `${s.label}: 반복 실행 reason`);
      assert.equal(rev.reason, a.reason, `${s.label}: Court 역순 reason`);
    }
  }
});

test("property: seed 를 바꾸면 결과가 달라질 수 있고 operational 목표는 유지된다", () => {
  const participants = mkParticipants(8);
  const targets = mkTargets({ count: 12 });
  const cfg = mkConfig();
  const hashes = new Set<string>();
  for (const seed of ["s-a", "s-b", "s-c", "s-d", "s-e"]) {
    const r = run(cfg, mkInput(participants, targets), seed);
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    hashes.add(r.resultHash);
    // seed 가 operational 품질을 악화시키지 않는다
    assert.ok(r.summary.appearanceSpread <= 1, `spread ${r.summary.appearanceSpread}`);
    assert.ok(r.summary.maxConsecutiveStreak <= 2, `streak ${r.summary.maxConsecutiveStreak}`);
  }
  assert.ok(hashes.size >= 1);
});

// ── 품질 목표 ───────────────────────────────────────────────────
test("quality: 6명 1코트 10게임 — maxOpponentRepeat ≤ 4", () => {
  for (const seed of SEEDS) {
    const r = run(mkConfig(), mkInput(mkParticipants(6), mkTargets({ count: 10 })), seed);
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    const s = (r as PairingPreviewSuccess).summary;
    assert.ok(s.maxOpponentRepeat <= 4, `${seed}: maxOpponentRepeat ${s.maxOpponentRepeat}`);
    assert.ok(s.appearanceSpread <= 1, `${seed}: spread ${s.appearanceSpread}`);
    assert.ok(s.maxConsecutiveStreak <= 2, `${seed}: streak ${s.maxConsecutiveStreak}`);
  }
});

test("quality: 8명 1코트 12게임 — maxPartnerRepeat ≤ 3", () => {
  for (const seed of SEEDS) {
    const r = run(mkConfig(), mkInput(mkParticipants(8), mkTargets({ count: 12 })), seed);
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    const s = (r as PairingPreviewSuccess).summary;
    assert.ok(s.maxPartnerRepeat <= 3, `${seed}: maxPartnerRepeat ${s.maxPartnerRepeat}`);
    assert.ok(s.appearanceSpread <= 1, `${seed}: spread ${s.appearanceSpread}`);
    assert.ok(s.maxConsecutiveStreak <= 2, `${seed}: streak ${s.maxConsecutiveStreak}`);
  }
});

test("quality: 8명 2코트 6batch — maxPartnerRepeat ≤ 2", () => {
  for (const seed of SEEDS) {
    const r = run(
      mkConfig({ slot_mode: "ordered" }),
      mkInput(mkParticipants(8), mkTargets({ count: 12, courts: 2, slotMode: "ordered" })),
      seed,
    );
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    const s = (r as PairingPreviewSuccess).summary;
    assert.ok(s.maxPartnerRepeat <= 2, `${seed}: maxPartnerRepeat ${s.maxPartnerRepeat}`);
    assert.equal(s.appearanceSpread, 0, `${seed}: spread ${s.appearanceSpread}`);
  }
});

// ── 성능 ────────────────────────────────────────────────────────
test("performance: 16명 20게임", () => {
  const participants = mkParticipants(16);
  const targets = mkTargets({ count: 20 });
  const cfg = mkConfig();

  // warm-up
  run(cfg, mkInput(participants, targets), "warm");

  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const r = run(cfg, mkInput(participants, targets), `perf-${i}`);
    times.push(performance.now() - t0);
    assert.equal(r.ok, true);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);
  const heapMb = process.memoryUsage().heapUsed / 1048576;

  // 측정 환경을 항상 남긴다(느린 CI 판정에 필요하다).
  console.log(
    `[perf] node=${process.version} platform=${process.platform}/${process.arch} ` +
      `cpus=${(globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? "?"} ` +
      `avg=${avg.toFixed(0)}ms max=${max.toFixed(0)}ms heap=${heapMb.toFixed(0)}MB`,
  );

  // 임계값은 PAIRING_PERF=1 에서만 강제한다 — 공용 CI 러너의 변동으로 flaky 해지지 않게.
  if (process.env.PAIRING_PERF === "1") {
    assert.ok(avg < 1000, `평균 ${avg.toFixed(0)}ms >= 1000ms`);
    assert.ok(max < 2000, `최대 ${max.toFixed(0)}ms >= 2000ms`);
  } else {
    assert.ok(avg < 30000, `sanity 상한 초과: ${avg.toFixed(0)}ms`);
  }
});
