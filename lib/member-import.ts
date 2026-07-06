import type { StagingValidationStatus, MemberType } from "@/lib/supabase/database.types";

/** 주소에서 추출 가능한 생활권/동네 목록 (구 단위가 아님). 필요시 계속 추가. */
const KNOWN_DISTRICTS = [
  "당산",
  "망원",
  "합정",
  "성산",
  "상암",
  "문래",
  "목동",
  "염리",
  "신수",
  "서강",
  "공항",
  "도화",
  "현석",
  "용강",
  "대흥",
];

/** 주소 문자열에서 알려진 생활권 키워드를 찾아 반환한다. 못 찾으면 null. */
export function extractDistrict(address: string | null | undefined): string | null {
  if (!address) return null;
  for (const district of KNOWN_DISTRICTS) {
    if (address.includes(district)) return district;
  }
  return null;
}

/**
 * 숫자만 남기고 010으로 시작하는 11자리인지 검사한다.
 *
 * 엑셀에서 전화번호가 숫자 형식으로 저장되면 맨 앞의 0이 사라져
 * "01030643885"가 "1030643885"(10자리, "10"으로 시작)로 읽히는 경우가 있다.
 * 또한 XLSX 파싱 결과가 number 타입으로 오거나, 셀 서식에 따라
 * "1030643885.0" 같은 소수점/공백이 섞인 문자열로 올 수도 있다.
 * 입력 타입에 관계없이 항상 String()으로 강제 변환한 뒤 문자열 기준으로 처리한다.
 */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // 소수점 이하(.0 등)와 공백을 먼저 제거하고, 숫자가 아닌 문자를 모두 제거한다.
  const asString = String(raw).trim();
  const withoutDecimal = asString.split(".")[0];
  const digitsOnly = withoutDecimal.replace(/\D/g, "");

  let normalized = digitsOnly;
  if (normalized.length === 10 && normalized.startsWith("10")) {
    normalized = "0" + normalized;
  }

  return /^010\d{8}$/.test(normalized) ? normalized : null;
}

/** "정회원" / "준회원" / "게스트" 외의 표기를 최대한 매칭. 못 찾으면 null. */
export function normalizeMemberType(raw: string | null | undefined): MemberType | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.includes("정회원") || trimmed.toLowerCase() === "regular") return "정회원";
  if (trimmed.includes("준회원") || trimmed.toLowerCase() === "associate") return "준회원";
  if (trimmed.includes("게스트") || trimmed.toLowerCase() === "guest") return "게스트";
  return null;
}

/** 지역점수: 1~10 정수만 허용. 범위를 벗어나면 null. */
export function normalizeMapoScore(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

/** 출생연도 문자열을 정수로. 1900~현재연도 범위 밖이면 null. */
export function normalizeBirthYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(n) || n < 1900 || n > currentYear) return null;
  return n;
}

/** 원본 나이 문자열을 정수로. 0~120 범위 밖이면 null. */
export function normalizeAge(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 0 || n > 120) return null;
  return n;
}

/**
 * 나이 보정 규칙 (확정된 사양):
 * - birth_year가 있으면: corrected_age = 현재 연도 - birth_year
 * - birth_year가 없고 age만 있으면: corrected_age = age + 1
 * - 둘 다 없으면: corrected_age = null
 */
export function computeCorrectedAge(
  normalizedBirthYear: number | null,
  normalizedAge: number | null
): number | null {
  if (normalizedBirthYear !== null) {
    return new Date().getFullYear() - normalizedBirthYear;
  }
  if (normalizedAge !== null) {
    return normalizedAge + 1;
  }
  return null;
}

export interface NormalizedStagingRow {
  normalized_name: string | null;
  normalized_nickname: string | null;
  normalized_phone: string | null;
  normalized_address: string | null;
  normalized_district: string | null;
  normalized_age: number | null;
  normalized_mapo_score: number | null;
  normalized_member_type: string | null;
  normalized_birth_year: number | null;
  corrected_age: number | null;
  validation_status: StagingValidationStatus;
  validation_errors: string | null;
}

export interface RawStagingInput {
  raw_name: string | null;
  raw_nickname: string | null;
  raw_phone: string | null;
  raw_address: string | null;
  raw_age: string | null;
  raw_mapo_score: string | null;
  raw_member_type: string | null;
  raw_birth_year: string | null;
}

/**
 * 원본 행 하나를 정제하고 1차 검증한다. (phone 중복 검사는 이 함수 밖에서,
 * DB의 기존 phone 목록과 비교해야 하므로 별도로 처리한다.)
 */
export function normalizeStagingRow(raw: RawStagingInput): NormalizedStagingRow {
  const errors: string[] = [];

  const normalizedName = raw.raw_name?.trim() || null;
  const normalizedNickname = raw.raw_nickname?.trim() || normalizedName;
  const normalizedPhone = normalizePhone(raw.raw_phone);
  const normalizedAddress = raw.raw_address?.trim() || null;
  const normalizedDistrict = extractDistrict(normalizedAddress);
  const normalizedAge = normalizeAge(raw.raw_age);
  const normalizedMapoScore = normalizeMapoScore(raw.raw_mapo_score);
  const normalizedMemberType = normalizeMemberType(raw.raw_member_type);
  const normalizedBirthYear = normalizeBirthYear(raw.raw_birth_year);
  const correctedAge = computeCorrectedAge(normalizedBirthYear, normalizedAge);

  let status: StagingValidationStatus = "pending";

  if (!normalizedName) {
    errors.push("이름이 없습니다.");
    status = "missing_required";
  }
  if (!normalizedPhone) {
    errors.push(
      raw.raw_phone
        ? "휴대폰 번호 형식이 올바르지 않습니다 (010으로 시작하는 11자리 필요)."
        : "휴대폰 번호가 없습니다."
    );
    status = "missing_required";
  }
  if (raw.raw_mapo_score && normalizedMapoScore === null) {
    errors.push("지역점수는 1~10 사이여야 합니다.");
    if (status === "pending") status = "invalid_mapo_score";
  }
  if (correctedAge === null && (raw.raw_age || raw.raw_birth_year)) {
    errors.push("나이/출생연도 형식을 확인해주세요.");
    if (status === "pending") status = "needs_review";
  }
  if (!raw.raw_age && !raw.raw_birth_year) {
    if (status === "pending") status = "needs_review";
  }

  if (status === "pending") status = "valid";

  return {
    normalized_name: normalizedName,
    normalized_nickname: normalizedNickname,
    normalized_phone: normalizedPhone,
    normalized_address: normalizedAddress,
    normalized_district: normalizedDistrict,
    normalized_age: normalizedAge,
    normalized_mapo_score: normalizedMapoScore,
    normalized_member_type: normalizedMemberType,
    normalized_birth_year: normalizedBirthYear,
    corrected_age: correctedAge,
    validation_status: status,
    validation_errors: errors.length > 0 ? errors.join(" ") : null,
  };
}
