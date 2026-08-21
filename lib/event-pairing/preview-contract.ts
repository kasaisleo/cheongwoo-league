/**
 * lib/event-pairing/preview-contract.ts — Preview API 의 순수 계약 계층.
 *
 * Next.js / Supabase / server-only 에 의존하지 않는다. 그래서 route 와 달리
 * `node --test` 로 직접 검증할 수 있다(next/server 는 Node 가 해석하지 못한다).
 *
 * 책임:
 *   · request body 의 object/known-key/필수값 검증
 *   · capture RPC row shape 검증 + RunEventPairingArgs 조립
 *   · capture 오류 prefix → 공개 status/message 매핑
 *   · engine 실패 → 공개 status/message/code/evidence 매핑
 *
 * 하지 않는 것: 인증, Supabase client 생성, RPC 호출, DB/network, 현재 시각,
 *   난수, 엔진 알고리즘 재구현.
 *
 * 공개 응답에는 PostgreSQL 원문·stack·개인정보·snapshot 전문을 넣지 않는다.
 */
import type {
  PairingEvidence,
  PairingPreviewFailure,
  RunEventPairingArgs,
} from "./types.ts";
import { SEED_MAX_BYTES } from "./types.ts";
import { normalizeSeed } from "./canonical.ts";

/** 공개 오류 응답 조각. code/evidence 는 운영상 실패에만 붙인다. */
export interface PublicErrorInfo {
  readonly status: number;
  readonly error: string;
  readonly code?: string;
  readonly evidence?: PairingEvidence;
}

export interface PreviewRequestBody {
  readonly targetGameIds: readonly string[];
  readonly algorithmVersion: "v1";
  /** 원본 문자열. 정규화는 엔진이 한 번만 수행한다(이중 정규화 금지). */
  readonly seed: string;
}

export type ParseBodyResult =
  | { readonly ok: true; readonly value: PreviewRequestBody }
  | { readonly ok: false; readonly status: number; readonly error: string };

/** 허용 key는 정확히 이 셋뿐이다. 그 밖의 key 는 400 으로 거부한다. */
export const ALLOWED_BODY_KEYS: readonly string[] = ["targetGameIds", "algorithmVersion", "seed"];

/**
 * UUID 형식 조기 검증용. Postgres uuid 는 대소문자를 가리지 않으므로 여기서도
 * 대소문자를 허용한다 — API 는 "형식만" 거르고 나머지 계약(중복/정렬/개수/NULL)은
 * 0079 capture RPC 정본에 맡긴다.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const bad = (status: number, error: string): ParseBodyResult => ({ ok: false, status, error });

/**
 * URL path param 의 Event ID 형식 검증.
 *
 * capture RPC 의 인자는 p_event_id uuid 라서 잘못된 문자열을 그대로 넘기면
 * PostgreSQL UUID cast 오류가 나고, 그것을 미지 오류 500 으로 처리하면
 * 사용자 입력 실수가 서버 장애처럼 보인다. RPC 호출 전에 거른다.
 */
export function isValidEventIdParam(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * 잘못된 Event ID 응답. 존재하지 않는 Event 와 같은 404·같은 문구를 쓴다 —
 * 형식 오류와 부재를 구분해 주면 타 클럽 Event 존재 여부가 드러난다.
 * 입력 값을 문구에 담지 않는다.
 */
export const EVENT_ID_INVALID: PublicErrorInfo = {
  status: 404,
  error: "이벤트를 찾을 수 없습니다.",
};

/**
 * request body 를 검증한다. 배열을 dedupe 하거나 정렬하지 않는다 —
 * raw 길이 33 개를 dedupe 로 우회하지 못하게 막는 것이 RPC 쪽 계약이기 때문이다.
 */
export function parsePreviewBody(raw: unknown): ParseBodyResult {
  if (!isPlainObject(raw)) {
    return bad(400, "요청 형식이 올바르지 않습니다.");
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_BODY_KEYS.includes(key)) {
      return bad(400, "요청에 허용되지 않는 항목이 있습니다.");
    }
  }
  for (const key of ALLOWED_BODY_KEYS) {
    if (!(key in raw)) {
      return bad(400, "요청에 필요한 항목이 빠졌습니다.");
    }
  }

  if (raw.algorithmVersion !== "v1") {
    return bad(400, "지원하지 않는 알고리즘 버전입니다.");
  }

  const seed = raw.seed;
  if (typeof seed !== "string") {
    return bad(400, "시드를 입력해주세요.");
  }
  const normalized = normalizeSeed(seed, SEED_MAX_BYTES);
  if (!normalized.ok) {
    return bad(
      400,
      normalized.issue === "TOO_LONG" ? "시드가 너무 깁니다." : "시드를 입력해주세요.",
    );
  }

  const ids = raw.targetGameIds;
  if (!Array.isArray(ids)) {
    return bad(400, "대상 게임 목록이 올바르지 않습니다.");
  }
  if (ids.length === 0) {
    return bad(400, "대상 게임을 선택해주세요.");
  }
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return bad(400, "대상 게임 목록이 올바르지 않습니다.");
    }
  }

  return {
    ok: true,
    // 입력 순서와 중복을 그대로 보존한다.
    value: { targetGameIds: ids as string[], algorithmVersion: "v1", seed },
  };
}

// ── capture row ────────────────────────────────────────────────
export type CaptureRowResult =
  | { readonly ok: true; readonly args: RunEventPairingArgs }
  | { readonly ok: false; readonly status: number; readonly error: string };

const CAPTURE_FAILED = "자동 대진 미리보기에 실패했습니다.";

/**
 * capture RPC 반환(RETURNS TABLE → 1행 배열)을 검증하고 엔진 인자를 조립한다.
 * snake/camel 변환을 하지 않는다 — 엔진 타입이 capture 출력 형태 그대로다.
 */
export function buildEngineArgs(
  rows: unknown,
  body: PreviewRequestBody,
): CaptureRowResult {
  if (!Array.isArray(rows) || rows.length !== 1) {
    return { ok: false, status: 500, error: CAPTURE_FAILED };
  }
  const row = rows[0];
  if (!isPlainObject(row)) {
    return { ok: false, status: 500, error: CAPTURE_FAILED };
  }
  if (!("config_snapshot" in row) || !("input_snapshot" in row) || !("input_hash" in row)) {
    return { ok: false, status: 500, error: CAPTURE_FAILED };
  }
  if (typeof row.input_hash !== "string") {
    return { ok: false, status: 500, error: CAPTURE_FAILED };
  }
  return {
    ok: true,
    args: {
      configSnapshot: row.config_snapshot,
      inputSnapshot: row.input_snapshot,
      inputHash: row.input_hash,
      seed: body.seed,
      algorithmVersion: body.algorithmVersion,
    },
  };
}

// ── capture 오류 매핑 ──────────────────────────────────────────
/**
 * capture RPC 가 raise 한 오류 코드를 공개 status/문구로 바꾼다.
 * PostgreSQL 원문을 그대로 돌려주지 않는다.
 *
 * 주의: CONFIG_SNAPSHOT_* 는 capture 내부 invariant 위반(서버 결함)이므로
 * 반드시 일반 CONFIG_ 매핑보다 먼저 500 으로 판정한다.
 */
export function mapCaptureRpcError(message: string | undefined): PublicErrorInfo {
  const msg = message ?? "";
  const is = (code: string): boolean => msg.startsWith(code);

  // 내부 invariant — 관리자가 고칠 수 있는 것이 아니다.
  if (is("CONFIG_SNAPSHOT_")) return { status: 500, error: CAPTURE_FAILED };
  if (msg.startsWith("M0079_")) return { status: 500, error: CAPTURE_FAILED };

  if (is("EVENT_NOT_FOUND")) return { status: 404, error: "이벤트를 찾을 수 없습니다." };
  if (is("EVENT_STRUCTURE_LOCKED")) {
    return { status: 409, error: "완료·취소된 이벤트는 자동 대진을 만들 수 없습니다." };
  }
  if (is("AUTO_GENERATION_DISABLED")) {
    return { status: 409, error: "이 이벤트는 자동 대진이 꺼져 있습니다. 이벤트 설정에서 켜주세요." };
  }

  // target 배열 입력 계약 (0079 정본)
  if (is("TARGET_GAME_IDS_REQUIRED")) return { status: 400, error: "대상 게임을 선택해주세요." };
  if (is("TARGET_GAME_IDS_LIMIT_EXCEEDED")) {
    return { status: 400, error: "한 번에 최대 32개 게임까지 선택할 수 있습니다." };
  }
  if (is("TARGET_GAME_IDS_INVALID")) {
    return { status: 400, error: "대상 게임 목록이 올바르지 않습니다." };
  }

  // 타 클럽/타 이벤트 존재 여부를 흘리지 않는다 — 기존 games route 관례와 동일하게 404.
  if (is("TARGET_NOT_FOUND")) return { status: 404, error: "대상 게임을 찾을 수 없습니다." };
  if (is("TARGET_EVENT_CLUB_MISMATCH")) {
    return { status: 404, error: "대상 게임을 찾을 수 없습니다." };
  }

  // 선행 단계·상태 충돌
  if (is("TARGET_NOT_DRAFT")) {
    return { status: 409, error: "진행·완료·취소된 게임은 자동 배정 대상이 아닙니다." };
  }
  if (is("TARGET_LINEUP_NOT_EMPTY")) {
    return { status: 409, error: "이미 선수가 배정된 게임은 자동 배정 대상이 아닙니다." };
  }
  if (is("TARGET_ALREADY_AUTO")) {
    return { status: 409, error: "이미 자동 배정된 게임은 다시 배정할 수 없습니다." };
  }
  if (is("TARGET_FORMAT_UNSUPPORTED")) {
    return { status: 409, error: "자동 대진은 복식 게임만 지원합니다." };
  }
  if (is("TARGET_CATEGORY_NULL") || is("TARGET_CATEGORY_NOT_CONFIGURED")) {
    return { status: 409, error: "게임 종류를 먼저 지정해주세요." };
  }
  if (is("TARGET_COURT_REQUIRED")) {
    return { status: 409, error: "대상 게임의 코트를 먼저 배정해주세요." };
  }
  if (is("TARGET_SESSION_REQUIRED")) {
    return { status: 409, error: "대상 게임의 슬롯을 먼저 배정해주세요." };
  }
  if (is("TARGET_SESSION_TIME_INCOMPLETE")) {
    return { status: 409, error: "대상 게임 슬롯의 시작·종료 시각을 먼저 입력해주세요." };
  }

  // 기존 Game 데이터 정리 필요
  if (is("BASE_SESSION_TIME_INCOMPLETE")) {
    return { status: 409, error: "선수가 배정된 기존 게임의 슬롯 시각이 비어 있습니다. 먼저 정리해주세요." };
  }
  if (is("BASE_SESSION_INCOMPLETE")) {
    return { status: 409, error: "선수가 배정된 기존 게임의 코트·슬롯 정보가 비어 있습니다. 먼저 정리해주세요." };
  }
  if (is("BASE_LINEUP_INVALID")) {
    return { status: 409, error: "기존 게임의 선수 구성이 올바르지 않습니다. 먼저 정리해주세요." };
  }
  if (is("MATCH_PARTICIPANT_TEAM_AMBIGUOUS")) {
    return {
      status: 409,
      error: "같은 경기의 양 팀에 동시에 기록된 선수가 있어 전적을 계산할 수 없습니다. 경기 기록을 확인해주세요.",
    };
  }

  return { status: 500, error: CAPTURE_FAILED };
}

// ── engine 실패 매핑 ───────────────────────────────────────────
/**
 * 엔진 실패를 공개 응답으로 바꾼다.
 *   운영상 실패(409) : code + evidence 를 노출한다 — 관리자가 무엇을 고칠지 알아야 한다.
 *   내부 계약 위반(500) : evidence 를 노출하지 않는다.
 *   body 버전 오류(400) : code 만 노출한다.
 */
export function mapEngineFailure(failure: PairingPreviewFailure): PublicErrorInfo {
  switch (failure.reason) {
    case "CATEGORY_SHORTAGE":
      return {
        status: 409,
        error: "지정한 게임 종류를 만들 수 있는 참가자가 부족합니다.",
        code: failure.reason,
        evidence: failure.evidence,
      };
    case "NO_ELIGIBLE_SUBSET":
      return {
        status: 409,
        error: "배정할 수 있는 참가자가 부족합니다.",
        code: failure.reason,
        evidence: failure.evidence,
      };
    case "NO_FEASIBLE_ROUND_PLAN":
      return {
        status: 409,
        error: "현재 조건으로는 대진을 만들 수 없습니다.",
        code: failure.reason,
        evidence: failure.evidence,
      };
    case "PAIRING_ALGORITHM_UNSUPPORTED":
      return { status: 400, error: "지원하지 않는 알고리즘 버전입니다.", code: failure.reason };
    case "PAIRING_INPUT_INVALID":
    case "PAIRING_CONFIG_VERSION_MISMATCH":
    default:
      // capture 출력이 엔진 계약을 어긴 경우 = 서버 결함. 세부는 숨긴다.
      return { status: 500, error: CAPTURE_FAILED };
  }
}

/** 예상 밖 예외에 쓰는 고정 응답. 원문·stack 을 노출하지 않는다. */
export const UNEXPECTED_ERROR: PublicErrorInfo = { status: 500, error: CAPTURE_FAILED };
