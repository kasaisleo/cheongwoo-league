/**
 * lib/event-pairing/core.ts — 순수 결정론 엔진의 공개 계산 진입점.
 *
 * 의존: 하위 8개 모듈 전부. 이 파일은 조합만 한다.
 *
 * 이 파일에는 `server-only` import 가 없다 — node --test 가 직접 import 한다.
 * 제품 코드는 반드시 engine.ts 를 통해 쓴다(core.ts 직접 import 금지).
 *
 * 절대 계약:
 *   DB/network 호출 0, Date.now()/현재 연도 조회 0, Math.random() 0,
 *   rating/grade/skill_grade/years_playing 0, config override 0,
 *   신규 Game 생성 0, target 밖 Game 변경 0.
 *   calculationYear 는 config_snapshot 값만 쓴다.
 */
import type {
  PairingEvidence,
  PairingGameDecision,
  PairingPreviewFailure,
  PairingPreviewResult,
  PairingPreviewSuccess,
  PairingSummary,
  PairingWarning,
  PairingWarningCode,
  RunEventPairingArgs,
} from "./types.ts";
import {
  DECISION_REASON_ORDER,
  PAIRING_ALGORITHM_VERSION,
} from "./types.ts";
import {
  assertEvidence,
  canonicalHash,
  canonicalStringify,
  compareStringArrays,
  normalizeSeed,
} from "./canonical.ts";
import {
  configConstantsMatch,
  validateRunInput,
  validationEvidence,
  type ValidationFailure,
} from "./validate.ts";
import { averageHalfUp, buildPowerMap, powerDifferenceBp } from "./power.ts";
import { buildBatchPlan, canonicalSort } from "./scheduling.ts";
import { buildHistory, lineupToTeams, maxStreakOf, type PlayedGame } from "./history.ts";
import { repeatOverageEvidence, type ParticipantFacts } from "./candidates.ts";
import { planNextBatch, toPlayedGame, type BeamContext } from "./beam.ts";
import { SEED_MAX_BYTES } from "./types.ts";

/** 실패 응답을 만든다. games/summary/resultHash 는 넣지 않는다. */
function failure(
  seed: string,
  inputHash: string,
  reason: PairingPreviewFailure["reason"],
  evidence: PairingEvidence,
  warnings: readonly PairingWarning[],
): PairingPreviewFailure {
  return {
    ok: false,
    algorithmVersion: PAIRING_ALGORITHM_VERSION,
    seed,
    inputHash,
    reason,
    evidence: assertEvidence(evidence),
    warnings,
  };
}

/** warning 을 canonical 순서로 정렬한다(code → evidence canonical JSON). */
function sortWarnings(list: readonly PairingWarning[]): PairingWarning[] {
  return [...list].sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    const ea = canonicalStringify(a.evidence);
    const eb = canonicalStringify(b.evidence);
    return ea < eb ? -1 : ea > eb ? 1 : 0;
  });
}

/** 같은 code+evidence 중복을 제거한다. */
function dedupeWarnings(list: readonly PairingWarning[]): PairingWarning[] {
  const seen = new Set<string>();
  const out: PairingWarning[] = [];
  for (const w of list) {
    const k = `${w.code}|${canonicalStringify(w.evidence)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/**
 * 자동 대진 preview 계산. 순수 함수다.
 */
export function runEventPairing(args: RunEventPairingArgs): PairingPreviewResult {
  // seed 는 실패 응답에도 넣어야 하므로 먼저 정규화한다(실패해도 빈 문자열로).
  const seedPre = normalizeSeed(args.seed, SEED_MAX_BYTES);
  const seedForResponse = seedPre.ok ? seedPre.seed : "";
  const hashForResponse =
    typeof args.inputHash === "string" && /^[0-9a-f]{64}$/.test(args.inputHash) ? args.inputHash : "";

  if (args.algorithmVersion !== PAIRING_ALGORITHM_VERSION) {
    return failure(
      seedForResponse,
      hashForResponse,
      "PAIRING_ALGORITHM_UNSUPPORTED",
      { requested: typeof args.algorithmVersion === "string" ? args.algorithmVersion : null, supported: PAIRING_ALGORITHM_VERSION },
      [],
    );
  }

  const v = validateRunInput({
    configSnapshot: args.configSnapshot,
    inputSnapshot: args.inputSnapshot,
    inputHash: args.inputHash,
    seed: args.seed,
  });
  if (!v.ok) {
    const f = v as ValidationFailure;
    return failure(seedForResponse, hashForResponse, "PAIRING_INPUT_INVALID", validationEvidence(f), []);
  }

  const { config, input, inputHash, seed, resolved } = v;

  if (!configConstantsMatch(config)) {
    return failure(
      seed,
      inputHash,
      "PAIRING_CONFIG_VERSION_MISMATCH",
      {
        expected: {
          powerEpsilonBp: 2000,
          candidateTopK: 8,
          beamWidth: 32,
          lookaheadDepth: 2,
          doublesOnly: true,
        },
        actual: {
          powerEpsilonBp: config.powerEpsilonBp,
          candidateTopK: config.candidateTopK,
          beamWidth: config.beamWidth,
          lookaheadDepth: config.lookaheadDepth,
          doublesOnly: config.doublesOnly,
        },
      },
      [],
    );
  }

  // ── 파생 준비 ────────────────────────────────────────────────
  const participantIds = input.participants.map((p) => p.id).sort();
  const powers = buildPowerMap(input.participants, resolved.calculationYear);
  const facts = new Map<string, ParticipantFacts>();
  for (const p of input.participants) facts.set(p.id, { gender: p.gender, hand: p.dominantHand });

  const warnings: PairingWarning[] = [];
  collectProfileWarnings(input, powers, warnings);

  const baseGames: PlayedGame[] = input.baseGames.map((g) => {
    const { teamA, teamB } = lineupToTeams(g.lineup);
    return {
      id: g.id,
      position: g.position,
      courtPosition: g.courtPosition,
      sessionPosition: g.sessionPosition,
      sessionStartsAt: g.sessionStartsAt,
      sessionEndsAt: g.sessionEndsAt,
      teamA,
      teamB,
    };
  });

  const batches = buildBatchPlan(input.targetGames, resolved.slotMode);
  const ctx: BeamContext = {
    participantIds,
    slotMode: resolved.slotMode,
    config: resolved,
    powers,
    facts,
    seed,
  };

  // ── batch 순차 확정 ─────────────────────────────────────────
  const committed: PlayedGame[] = [];
  const decisions: PairingGameDecision[] = [];
  const relaxedCodes: PairingWarningCode[] = [];
  let effectiveLookahead = 0;

  for (let i = 0; i < batches.length; i++) {
    const res = planNextBatch([...baseGames, ...committed], batches.slice(i), ctx);
    if (i === 0) effectiveLookahead = res.effectiveLookahead;
    if (!res.ok) {
      const reason = res.shortage !== null ? "CATEGORY_SHORTAGE" : "NO_FEASIBLE_ROUND_PLAN";
      const evidence: PairingEvidence =
        res.shortage !== null
          ? res.shortage
          : { failedGameId: res.failedGameId, batchIndex: i + 1, batchKey: batches[i].batchKey };
      for (const c of res.relaxed) relaxedCodes.push(c);
      pushRelaxWarnings(relaxedCodes, resolved, warnings);
      return failure(seed, inputHash, reason, evidence, sortWarnings(dedupeWarnings(warnings)));
    }
    for (const c of res.relaxed) relaxedCodes.push(c);
    for (const a of res.assignments) {
      const played = toPlayedGame(a);
      committed.push(played);
      decisions.push({
        gameId: a.target.id,
        genderCategory: a.target.genderCategory,
        teamA: orderTeam(a.candidate.teamA),
        teamB: orderTeam(a.candidate.teamB),
        powerDifferenceBp: a.candidate.powerDiffBp,
        reasons: decisionReasonsFor(a.candidate.handImbalance, res.tiedCount, effectiveLookahead),
      });
    }
  }

  // ── summary ─────────────────────────────────────────────────
  const allGames = [...baseGames, ...committed];
  const history = buildHistory(allGames, participantIds, resolved.slotMode);
  const apps = participantIds.map((id) => history.appearance.get(id) ?? 0);
  const partnerCounts = [...history.partner.values()];
  const opponentCounts = [...history.opponent.values()];
  const diffs = committed.map((g) => powerDifferenceBp(g.teamA, g.teamB, powers));

  pushRelaxWarnings(relaxedCodes, resolved, warnings);
  const repeatEvidence = repeatOverageEvidence(history, resolved);
  if (repeatEvidence !== null) warnings.push({ code: "REPEAT_LIMIT_RELAXED", evidence: repeatEvidence });
  if (diffs.some((d) => d > 0)) {
    warnings.push({
      code: "POWER_TOLERANCE_APPLIED",
      evidence: { epsilonBp: resolved.powerEpsilonBp, maxObservedDiffBp: Math.max(...diffs) },
    });
  }
  if (effectiveLookahead < resolved.lookaheadDepth) {
    warnings.push({
      code: "PAIRING_HORIZON_SHORT",
      evidence: {
        targetGameCount: input.targetGames.length,
        schedulingBatchCount: batches.length,
        configuredLookaheadDepth: resolved.lookaheadDepth,
        effectiveLookaheadDepth: effectiveLookahead,
      },
    });
  }

  const summary: PairingSummary = {
    targetGameCount: input.targetGames.length,
    schedulingBatchCount: batches.length,
    assignedGameCount: committed.length,
    eligibleParticipantCount: participantIds.length,
    appearanceMin: apps.length > 0 ? Math.min(...apps) : 0,
    appearanceMax: apps.length > 0 ? Math.max(...apps) : 0,
    appearanceSpread: apps.length > 0 ? Math.max(...apps) - Math.min(...apps) : 0,
    maxConsecutiveStreak:
      participantIds.length > 0
        ? Math.max(...participantIds.map((id) => maxStreakOf(id, history, resolved.slotMode, resolved)))
        : 0,
    distinctPartnerPairs: history.partner.size,
    maxPartnerRepeat: partnerCounts.length > 0 ? Math.max(...partnerCounts) : 0,
    distinctOpponentPairs: history.opponent.size,
    maxOpponentRepeat: opponentCounts.length > 0 ? Math.max(...opponentCounts) : 0,
    averagePowerDifferenceBp: averageHalfUp(diffs),
    maxPowerDifferenceBp: diffs.length > 0 ? Math.max(...diffs) : 0,
    relaxedConstraintCount: new Set(relaxedCodes).size,
  };

  const finalWarnings = sortWarnings(dedupeWarnings(warnings));
  const games = canonicalSortDecisions(decisions, input, resolved.slotMode);

  const resultHash = canonicalHash({
    algorithmVersion: PAIRING_ALGORITHM_VERSION,
    seed,
    inputHash,
    games: games.map((g) => ({
      gameId: g.gameId,
      genderCategory: g.genderCategory,
      teamA: [...g.teamA],
      teamB: [...g.teamB],
      powerDifferenceBp: g.powerDifferenceBp,
      reasons: [...g.reasons],
    })),
    summary: { ...summary },
    warnings: finalWarnings.map((w) => ({ code: w.code, evidence: w.evidence })),
  });

  const success: PairingPreviewSuccess = {
    ok: true,
    algorithmVersion: PAIRING_ALGORITHM_VERSION,
    seed,
    inputHash,
    resultHash,
    games,
    summary,
    warnings: finalWarnings,
  };
  return success;
}

/** 팀 내부 slot 순서를 결정론적으로 고정한다(참가자 ID 사전순 = slot 1,2). */
function orderTeam(team: readonly string[]): string[] {
  return [...team].sort();
}

/** decision 은 target scheduling canonical order 로 출력한다. */
function canonicalSortDecisions(
  decisions: readonly PairingGameDecision[],
  input: { readonly targetGames: readonly { readonly id: string }[] },
  slotMode: BeamContext["slotMode"],
): PairingGameDecision[] {
  const order = new Map<string, number>();
  const sortedTargets = canonicalSort(
    input.targetGames as unknown as Parameters<typeof canonicalSort>[0],
    slotMode,
  );
  sortedTargets.forEach((g, i) => order.set(g.id, i));
  return [...decisions].sort((a, b) => {
    const ia = order.get(a.gameId) ?? 0;
    const ib = order.get(b.gameId) ?? 0;
    if (ia !== ib) return ia - ib;
    return compareStringArrays([a.gameId], [b.gameId]);
  });
}

/** decision reason 을 고정 순서로 만든다. 자연어는 없다. */
function decisionReasonsFor(
  handImbalance: number,
  tiedCount: number,
  effectiveLookahead: number,
): PairingGameDecision["reasons"] {
  const set = new Set<(typeof DECISION_REASON_ORDER)[number]>([
    "APPEARANCE_BALANCE",
    "PARTNER_DIVERSITY",
    "OPPONENT_DIVERSITY",
    "POWER_BALANCE",
    "GENDER_CATEGORY",
  ]);
  if (handImbalance === 0) set.add("HAND_DISTRIBUTION");
  if (tiedCount > 1) set.add("SEED_TIE_BREAK");
  if (effectiveLookahead > 1) set.add("LOOKAHEAD_DIVERSITY");
  return DECISION_REASON_ORDER.filter((r) => set.has(r));
}

/** 프로필 결측 warning 을 집계한다(참가자 ID 는 정렬해 담는다). */
function collectProfileWarnings(
  input: { readonly participants: readonly { readonly id: string; readonly gender: string; readonly dominantHand: string }[] },
  powers: ReturnType<typeof buildPowerMap>,
  out: PairingWarning[],
): void {
  const medianImputed: string[] = [];
  const neutralImputed: string[] = [];
  const experienceNeutral: string[] = [];
  const genderUnspecified: string[] = [];
  const handUnspecified: string[] = [];
  for (const p of input.participants) {
    const b = powers.get(p.id);
    if (b === undefined) continue;
    if (b.mapoImputedFromMedian) medianImputed.push(p.id);
    if (b.mapoImputedNeutral) neutralImputed.push(p.id);
    if (b.experienceNeutral) experienceNeutral.push(p.id);
    if (p.gender === "unspecified") genderUnspecified.push(p.id);
    if (p.dominantHand === "unspecified") handUnspecified.push(p.id);
  }
  const push = (code: PairingWarningCode, ids: string[]): void => {
    if (ids.length === 0) return;
    out.push({ code, evidence: { affectedParticipantCount: ids.length, participantIds: ids.sort() } });
  };
  push("MAPO_MEDIAN_IMPUTED", medianImputed);
  push("MAPO_NEUTRAL_IMPUTED", neutralImputed);
  push("EXPERIENCE_NEUTRAL", experienceNeutral);
  push("GENDER_UNSPECIFIED", genderUnspecified);
  push("HAND_UNSPECIFIED", handUnspecified);
}

/** 실제로 완화가 일어난 축만 warning 으로 남긴다. */
function pushRelaxWarnings(
  codes: readonly PairingWarningCode[],
  resolved: { readonly consecutiveGamesLimit: number; readonly requiredRestGapMs: number },
  out: PairingWarning[],
): void {
  const uniq = new Set(codes);
  if (uniq.has("CONSECUTIVE_LIMIT_RELAXED"))
    out.push({ code: "CONSECUTIVE_LIMIT_RELAXED", evidence: { limit: resolved.consecutiveGamesLimit } });
  if (uniq.has("REST_LIMIT_RELAXED"))
    out.push({ code: "REST_LIMIT_RELAXED", evidence: { requiredRestGapMs: resolved.requiredRestGapMs } });
  if (uniq.has("APPEARANCE_BALANCE_RELAXED"))
    out.push({ code: "APPEARANCE_BALANCE_RELAXED", evidence: { reason: "CATEGORY_CONSTRAINT" } });
}
