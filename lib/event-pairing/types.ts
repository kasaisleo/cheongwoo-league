/**
 * lib/event-pairing/types.ts — 자동 대진 엔진 v1 타입 계약 (Phase 2A-9D-B79-2).
 *
 * 이 파일은 의존이 없다(엔진 모듈 그래프의 최하단). reason/warning code 상수도
 * 여기에 둔다 — 별도 reasons.ts 를 만들지 않는다.
 *
 * DB snake_case 는 config_snapshot 안에서만 유지한다(0079 capture 가 만든 키
 * 그대로). 엔진 내부 도메인 타입과 응답은 camelCase 다. 변환 경계는
 * validate.ts 한 곳뿐이다.
 */

// ── JSON evidence ───────────────────────────────────────────────
/** canonical serializer 가 허용하는 원시값. undefined/bigint/symbol 은 없다. */
export type PairingJsonPrimitive = string | number | boolean | null;
/** 중첩 object/array 를 허용하는 재귀 JSON 값. Date/Map/Set/function 은 없다. */
export type PairingJsonValue =
  | PairingJsonPrimitive
  | readonly PairingJsonValue[]
  | { readonly [key: string]: PairingJsonValue };
/** 모든 reason/warning/decision evidence 의 정본 타입. */
export type PairingEvidence = Readonly<Record<string, PairingJsonValue>>;

// ── enum 성격 union ─────────────────────────────────────────────
export type PairingAlgorithmVersion = "v1";
export type PairingSlotMode = "none" | "ordered" | "timed";
export type PairingGenderCategory = "mens" | "womens" | "mixed" | "open";
export type PairingGender = "male" | "female" | "unspecified";
export type PairingHand = "right" | "left" | "unspecified";
export type PairingValueSource = "snapshot" | "member" | "none";
export type PairingParticipantType = "member" | "guest";
export type PairingGameFormat = "singles" | "doubles";
export type PairingGameStatus = "draft" | "in_progress" | "completed" | "cancelled";
export type PairingGameSource = "manual" | "auto";
export type PairingEventStatus = "draft" | "active" | "completed" | "cancelled";
export type PairingTeam = "a" | "b";

// ── 알고리즘 상수 (v1 고정) ─────────────────────────────────────
export const PAIRING_ALGORITHM_VERSION: PairingAlgorithmVersion = "v1";
export const POWER_EPSILON_BP = 2000;
export const CANDIDATE_TOP_K = 8;
export const BEAM_WIDTH = 32;
export const LOOKAHEAD_DEPTH = 2;
export const DOUBLES_ONLY = true;
/** consecutive_games_limit 이 null 일 때 쓰는 v1 기본값. */
export const DEFAULT_CONSECUTIVE_GAMES_LIMIT = 2;
/** partner/opponent repeat limit 이 null 일 때의 기본 허용 횟수. */
export const DEFAULT_REPEAT_LIMIT = 1;
/** seed 의 UTF-8 바이트 길이 상한. */
export const SEED_MAX_BYTES = 128;
/** target Game 배열 상한(0079 capture 와 동일). */
export const TARGET_GAME_MAX = 32;

// ── config snapshot (0079 capture 원본, snake_case 유지) ────────
/**
 * 0079 capture 가 만드는 22키. normalize_match_config 15키 + 알고리즘 상수 6 +
 * calculationYear 1. 모든 키가 반드시 존재한다(누락은 validation 실패).
 */
export interface PairingConfigSnapshotV1 {
  readonly version: 1;
  readonly slot_mode: PairingSlotMode;
  readonly court_count: number | null;
  readonly rest_gap_minutes: number | null;
  readonly max_games_per_member: number | null;
  readonly partner_repeat_limit: number | null;
  readonly opponent_repeat_limit: number | null;
  readonly consecutive_games_limit: number | null;
  readonly review_required: boolean;
  readonly attendance_enabled: boolean;
  readonly live_queue_enabled: boolean;
  readonly pre_scheduling_enabled: boolean;
  readonly auto_generation_enabled: boolean;
  readonly court_assignment_enabled: boolean;
  readonly participant_confirmation_required: boolean;
  readonly algorithmVersion: PairingAlgorithmVersion;
  readonly powerEpsilonBp: number;
  readonly candidateTopK: number;
  readonly beamWidth: number;
  readonly lookaheadDepth: number;
  readonly doublesOnly: boolean;
  readonly calculationYear: number;
}

/**
 * 엔진 내부에서 쓰는 resolved config. 원본 null 을 v1 기본값으로 해석한 결과다.
 * config_snapshot 원본은 절대 바꾸지 않는다 — 여기서만 해석한다.
 */
export interface PairingResolvedConfig {
  readonly slotMode: PairingSlotMode;
  readonly calculationYear: number;
  /** null → DEFAULT_CONSECUTIVE_GAMES_LIMIT(2). */
  readonly consecutiveGamesLimit: number;
  /** null → DEFAULT_REPEAT_LIMIT(1). */
  readonly partnerRepeatLimit: number;
  /** null → DEFAULT_REPEAT_LIMIT(1). */
  readonly opponentRepeatLimit: number;
  /** null 이면 제한 없음. */
  readonly maxGamesPerMember: number | null;
  /** rest_gap_minutes 를 ms 정수로 환산. null → 0(back-to-back 만 consecutive). */
  readonly requiredRestGapMs: number;
  /** rest_gap_minutes 원본이 null 이었는지. evidence 구분용. */
  readonly restGapConfigured: boolean;
  readonly powerEpsilonBp: number;
  readonly candidateTopK: number;
  readonly beamWidth: number;
  readonly lookaheadDepth: number;
}

// ── input snapshot (0079 capture 원본) ──────────────────────────
export interface PairingParticipantInput {
  readonly id: string;
  readonly participantType: PairingParticipantType;
  readonly memberId: string | null;
  readonly guestId: string | null;
  readonly gender: PairingGender;
  readonly genderSource: PairingValueSource;
  readonly tennisStartYear: number | null;
  readonly tennisStartYearSource: PairingValueSource;
  readonly dominantHand: PairingHand;
  readonly dominantHandSource: PairingValueSource;
  readonly mapoScore: number | null;
  readonly mapoScoreSource: PairingValueSource;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface PairingTargetGameInput {
  readonly id: string;
  readonly position: number;
  readonly format: PairingGameFormat;
  readonly genderCategory: PairingGenderCategory;
  readonly courtId: string | null;
  readonly courtPosition: number | null;
  readonly sessionId: string | null;
  readonly sessionPosition: number | null;
  /** UTC 'YYYY-MM-DDTHH:MM:SSZ'. 로컬 timezone 변환에 쓰지 않는다. */
  readonly sessionStartsAt: string | null;
  readonly sessionEndsAt: string | null;
}

export interface PairingLineupPlayer {
  readonly participantId: string;
  readonly team: PairingTeam;
  readonly slot: number;
}

export interface PairingBaseGameInput extends PairingTargetGameInput {
  readonly status: PairingGameStatus;
  readonly source: PairingGameSource;
  readonly pairingRunId: string | null;
  readonly lineup: readonly PairingLineupPlayer[];
}

export interface PairingInputSnapshotV1 {
  readonly event: {
    readonly id: string;
    readonly clubId: string;
    readonly status: PairingEventStatus;
  };
  readonly participants: readonly PairingParticipantInput[];
  readonly targetGames: readonly PairingTargetGameInput[];
  readonly baseGames: readonly PairingBaseGameInput[];
}

// ── 파생 값 ─────────────────────────────────────────────────────
export interface PairingPowerBreakdown {
  readonly mapoBp: number;
  readonly recordBp: number;
  readonly experienceBp: number;
  readonly powerBp: number;
  readonly mapoImputedFromMedian: boolean;
  readonly mapoImputedNeutral: boolean;
  readonly recordNeutral: boolean;
  readonly experienceNeutral: boolean;
}

/** 같은 scheduling batch 에 속한 target Game 묶음. */
export interface PairingSchedulingBatch {
  readonly batchKey: string;
  readonly targets: readonly PairingTargetGameInput[];
}

/** 후보 비교용 사전순 vector. 정수와 hex 문자열만 담는다(float 금지). */
export type PairingCandidateVector = readonly (number | string)[];

// ── reason / warning code ───────────────────────────────────────
export type PairingReason =
  | "PAIRING_INPUT_INVALID"
  | "PAIRING_CONFIG_VERSION_MISMATCH"
  | "PAIRING_ALGORITHM_UNSUPPORTED"
  | "CATEGORY_SHORTAGE"
  | "NO_ELIGIBLE_SUBSET"
  | "NO_FEASIBLE_ROUND_PLAN";

export type PairingWarningCode =
  | "MAPO_MEDIAN_IMPUTED"
  | "MAPO_NEUTRAL_IMPUTED"
  | "EXPERIENCE_NEUTRAL"
  | "GENDER_UNSPECIFIED"
  | "HAND_UNSPECIFIED"
  | "PARTICIPANT_CATEGORY_INELIGIBLE"
  | "CONSECUTIVE_LIMIT_RELAXED"
  | "REST_LIMIT_RELAXED"
  | "APPEARANCE_BALANCE_RELAXED"
  | "REPEAT_LIMIT_RELAXED"
  | "POWER_TOLERANCE_APPLIED"
  | "PAIRING_HORIZON_SHORT";

export type PairingDecisionReason =
  | "APPEARANCE_BALANCE"
  | "REST_ROTATION"
  | "CONSECUTIVE_LIMIT"
  | "PARTNER_DIVERSITY"
  | "OPPONENT_DIVERSITY"
  | "POWER_BALANCE"
  | "HAND_DISTRIBUTION"
  | "GENDER_CATEGORY"
  | "SEED_TIE_BREAK"
  | "LOOKAHEAD_DIVERSITY";

/** decision reason 의 canonical 출력 순서(자연어 없음). */
export const DECISION_REASON_ORDER: readonly PairingDecisionReason[] = [
  "APPEARANCE_BALANCE",
  "REST_ROTATION",
  "CONSECUTIVE_LIMIT",
  "PARTNER_DIVERSITY",
  "OPPONENT_DIVERSITY",
  "POWER_BALANCE",
  "HAND_DISTRIBUTION",
  "GENDER_CATEGORY",
  "SEED_TIE_BREAK",
  "LOOKAHEAD_DIVERSITY",
];

export interface PairingWarning {
  readonly code: PairingWarningCode;
  readonly evidence: PairingEvidence;
}

// ── 결과 ────────────────────────────────────────────────────────
export interface PairingGameDecision {
  readonly gameId: string;
  readonly genderCategory: PairingGenderCategory;
  /** team a 의 participant ID. slot 1,2 순서로 결정론적이다. */
  readonly teamA: readonly string[];
  readonly teamB: readonly string[];
  readonly powerDifferenceBp: number;
  readonly reasons: readonly PairingDecisionReason[];
}

/**
 * fairness/diversity 지표는 base + preview target 누적이고,
 * *GameCount 는 target-only, power 지표는 새 target Game 기준이다.
 */
export interface PairingSummary {
  readonly targetGameCount: number;
  readonly schedulingBatchCount: number;
  readonly assignedGameCount: number;
  readonly eligibleParticipantCount: number;
  readonly appearanceMin: number;
  readonly appearanceMax: number;
  readonly appearanceSpread: number;
  readonly maxConsecutiveStreak: number;
  readonly distinctPartnerPairs: number;
  readonly maxPartnerRepeat: number;
  readonly distinctOpponentPairs: number;
  readonly maxOpponentRepeat: number;
  readonly averagePowerDifferenceBp: number;
  readonly maxPowerDifferenceBp: number;
  readonly relaxedConstraintCount: number;
}

export interface PairingPreviewSuccess {
  readonly ok: true;
  readonly algorithmVersion: PairingAlgorithmVersion;
  readonly seed: string;
  readonly inputHash: string;
  readonly resultHash: string;
  readonly games: readonly PairingGameDecision[];
  readonly summary: PairingSummary;
  readonly warnings: readonly PairingWarning[];
}

/** 실패에는 games/summary/resultHash 를 넣지 않는다. warnings 는 넣을 수 있다. */
export interface PairingPreviewFailure {
  readonly ok: false;
  readonly algorithmVersion: PairingAlgorithmVersion;
  readonly seed: string;
  readonly inputHash: string;
  readonly reason: PairingReason;
  readonly evidence: PairingEvidence;
  readonly warnings: readonly PairingWarning[];
}

export type PairingPreviewResult = PairingPreviewSuccess | PairingPreviewFailure;

/** core 공개 함수 입력. capture RPC 반환 3값 + API 입력 2값. */
export interface RunEventPairingArgs {
  readonly configSnapshot: unknown;
  readonly inputSnapshot: unknown;
  readonly inputHash: unknown;
  readonly seed: unknown;
  readonly algorithmVersion: unknown;
}
