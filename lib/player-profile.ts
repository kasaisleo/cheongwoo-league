import type { Gender, DominantHand } from "@/lib/supabase/database.types";

/**
 * 자동 대진용 선수 Profile 값의 검증 정본 (0074).
 *
 * DB는 text + CHECK로 값을 강제하고 연도는 1900~2200의 불변 범위만 본다.
 * "미래 연도 금지"는 여기서 처리한다 — CHECK에 now()를 넣으면 해가 바뀔 때
 * 기존 행이 위반 상태가 되기 때문이다.
 *
 * 회원 API와 Event participant Profile API가 같은 규칙을 쓰도록 한 곳에 둔다.
 */

export const GENDERS: readonly Gender[] = ["male", "female", "unspecified"] as const;
export const DOMINANT_HANDS: readonly DominantHand[] = ["right", "left", "unspecified"] as const;

/** DB CHECK의 하한. 상한은 현재 연도이므로 상수로 두지 않는다. */
export const TENNIS_START_YEAR_MIN = 1900;

export const GENDER_LABEL: Record<Gender, string> = {
  male: "남성",
  female: "여성",
  unspecified: "미지정",
};

export const DOMINANT_HAND_LABEL: Record<DominantHand, string> = {
  right: "오른손",
  left: "왼손",
  unspecified: "미지정",
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function parseGender(raw: unknown, field = "성별"): ParseResult<Gender> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "unspecified" };
  if (typeof raw === "string" && (GENDERS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as Gender };
  }
  return { ok: false, message: `${field} 값이 올바르지 않습니다.` };
}

export function parseDominantHand(raw: unknown, field = "주손"): ParseResult<DominantHand> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "unspecified" };
  if (typeof raw === "string" && (DOMINANT_HANDS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as DominantHand };
  }
  return { ok: false, message: `${field} 값이 올바르지 않습니다.` };
}

/**
 * 정수 또는 null만 통과시킨다. 빈 문자열은 "모름"(null)으로 정규화한다 —
 * 폼에서 지운 값이 그대로 넘어오기 때문이다. 소수·숫자가 아닌 문자열은 거부한다.
 */
function parseNullableInteger(raw: unknown, field: string): ParseResult<number | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, message: `${field}은(는) 정수로 입력해주세요.` };
  }
  return { ok: true, value: n };
}

/** 1900 이상, 현재 연도 이하. 미래 연도는 거부한다. */
export function parseTennisStartYear(raw: unknown, field = "테니스 시작 연도"): ParseResult<number | null> {
  const parsed = parseNullableInteger(raw, field);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return parsed;

  const currentYear = new Date().getFullYear();
  if (parsed.value < TENNIS_START_YEAR_MIN) {
    return { ok: false, message: `${field}은(는) ${TENNIS_START_YEAR_MIN}년 이후여야 합니다.` };
  }
  if (parsed.value > currentYear) {
    return { ok: false, message: `${field}은(는) ${currentYear}년보다 클 수 없습니다.` };
  }
  return parsed;
}

export interface PlayerProfileInput {
  gender: Gender;
  tennisStartYear: number | null;
  dominantHand: DominantHand;
}

/** 회원 생성·수정용. 값이 없으면 'unspecified' / null로 정규화한다. */
export function parsePlayerProfile(body: {
  gender?: unknown;
  tennisStartYear?: unknown;
  dominantHand?: unknown;
}): ParseResult<PlayerProfileInput> {
  const g = parseGender(body.gender);
  if (!g.ok) return { ok: false, message: g.message };
  const y = parseTennisStartYear(body.tennisStartYear);
  if (!y.ok) return { ok: false, message: y.message };
  const h = parseDominantHand(body.dominantHand);
  if (!h.ok) return { ok: false, message: h.message };
  return { ok: true, value: { gender: g.value, tennisStartYear: y.value, dominantHand: h.value } };
}

/**
 * Event participant snapshot 은 회원 Profile 과 달리 enum 도 nullable 이다.
 * NULL = "아직 굳지 않음" — 회원은 후속 자동 대진에서 회원 Profile 로 fallback /
 * materialize 될 대상이고, 게스트는 정보가 없다는 뜻이다. 이 상태를 UI 가 임의로
 * 'unspecified' 로 바꿔 저장하면 fallback 의미가 사라지므로 둘을 구분한다.
 */
export interface ParticipantProfileInput {
  gender: Gender | null;
  tennisStartYear: number | null;
  dominantHand: DominantHand | null;
}

function parseNullableGender(raw: unknown, field = "성별"): ParseResult<Gender | null> {
  if (raw === null) return { ok: true, value: null };
  if (raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw === "string" && (GENDERS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as Gender };
  }
  return { ok: false, message: `${field} 값이 올바르지 않습니다.` };
}

function parseNullableDominantHand(raw: unknown, field = "주손"): ParseResult<DominantHand | null> {
  if (raw === null) return { ok: true, value: null };
  if (raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw === "string" && (DOMINANT_HANDS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as DominantHand };
  }
  return { ok: false, message: `${field} 값이 올바르지 않습니다.` };
}

/**
 * Event participant snapshot용 — 세 값을 한 번에 교체하는 full-profile 계약이다.
 *
 * 세 key 가 모두 있어야 한다. 생략을 자동으로 null/unspecified 로 바꾸지 않는다 —
 * "이 필드는 그대로 두려던 것"과 "지우려던 것"이 body 모양만으로는 구분되지
 * 않기 때문이다. 지우려면 명시적으로 null(숫자) 또는 'unspecified'(enum)를 보낸다.
 *
 * 0075: rating 은 계약에서 제거됐다. 자동 대진은 rating 을 입력으로 쓰지 않는다.
 * body 에 rating 이 남아 있어도 읽지 않고 그냥 무시한다 — 알 수 없는 key 를
 * 오류로 만들지 않는 것이 이 저장소의 기존 라우트 관례이고, QA 클라이언트가
 * 일시적으로 네 key 를 보내도 파괴적으로 실패하지 않아야 한다.
 */
const PROFILE_KEYS = ["gender", "tennisStartYear", "dominantHand"] as const;

const KEY_LABEL: Record<(typeof PROFILE_KEYS)[number], string> = {
  gender: "성별",
  tennisStartYear: "테니스 시작 연도",
  dominantHand: "주손",
};

export function parseParticipantProfile(body: Record<string, unknown>): ParseResult<ParticipantProfileInput> {
  const missing = PROFILE_KEYS.filter((k) => !(k in body));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `${missing.map((k) => KEY_LABEL[k]).join(", ")} 값이 필요합니다. 세 항목을 모두 보내주세요.`,
    };
  }

  const g = parseNullableGender(body.gender);
  if (!g.ok) return { ok: false, message: g.message };
  const y = parseTennisStartYear(body.tennisStartYear);
  if (!y.ok) return { ok: false, message: y.message };
  const h = parseNullableDominantHand(body.dominantHand);
  if (!h.ok) return { ok: false, message: h.message };

  return {
    ok: true,
    value: { gender: g.value, tennisStartYear: y.value, dominantHand: h.value },
  };
}
