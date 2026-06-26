/**
 * Member Timeline / 선수출신 관련 공용 설정.
 *
 * association/division/result/timeline_type/player_background 값은 운영하면서
 * 계속 바뀔 수 있으므로 DB enum으로 강제하지 않고 text로 저장한다. 대신 이
 * 파일에서 허용값을 한 곳에 모아두고, UI Select·API 검증·향후 검색까지
 * 전부 이 상수를 참조하게 한다. 값 추가/수정이 필요하면 이 파일만 고치면 된다.
 */

// ─────────────────────────────────────────────────────────
// 선수출신 정보 (members.player_background)
// ─────────────────────────────────────────────────────────

export type PlayerBackground =
  | "none"
  | "elementary"
  | "middle"
  | "high"
  | "college_pro"
  | "soft_tennis"
  | "club_coach";

/** "비선출" 1단계, 나머지는 "선출" 선택 시 노출되는 2단계 세부값 */
export const PLAYER_BACKGROUND_OPTIONS: { value: PlayerBackground; label: string }[] = [
  { value: "none", label: "비선출" },
  { value: "elementary", label: "초등선출" },
  { value: "middle", label: "중등선출" },
  { value: "high", label: "고등선출" },
  { value: "college_pro", label: "대학/실업선출" },
  { value: "soft_tennis", label: "정구선출" },
  { value: "club_coach", label: "동호인지도자" },
];

export const PLAYER_BACKGROUND_VALUES = PLAYER_BACKGROUND_OPTIONS.map((o) => o.value);

export function isValidPlayerBackground(value: string): value is PlayerBackground {
  return (PLAYER_BACKGROUND_VALUES as string[]).includes(value);
}

export function playerBackgroundLabel(value: string): string {
  return PLAYER_BACKGROUND_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ─────────────────────────────────────────────────────────
// Timeline 종류 (member_timeline.timeline_type)
//
// 2024-XX 정리(1차): UI 선택지에서 "대회 입상(achievement)"과 "출석(attendance)"을
// 제거했다. achievement는 result(우승/준우승 등) 개념과 섞여 있던 표현이라
// "대회(competition)"로 대체했고, attendance는 자동 출석 데이터로 관리되며
// 더 이상 수동 Timeline 추가 대상이 아니다.
//
// 2024-XX 정리(2차): UI 선택지에서 "선수출신(career)"과 "운영(system)"을
// 추가로 제거했다. 선수출신/직책 정보는 이미 회원등록·회원수정 폼(members
// 테이블의 player_background 등)에 회원 속성으로 존재하고, Timeline은
// 회원의 사건/이력 기록이라 같은 개념을 두 군데서 입력받으면 중복·불일치가
// 생긴다. career/system은 이제 achievement/attendance와 동일하게 legacy로
// 취급한다.
//
// DB는 text 컬럼이라 과거에 career/system/achievement/attendance로 저장된
// row가 여전히 존재한다. 그 값들을 신규 선택 옵션에서만 빼고, 타입/라벨
// 매핑에서는 LegacyTimelineType으로 남겨 기존 데이터 렌더링·수정이 깨지지
// 않게 한다.
// ─────────────────────────────────────────────────────────

/** 신규 입력에서 선택 가능한 종류. UI 버튼·신규 등록 검증 기준이 된다. */
export type TimelineType = "join" | "competition" | "league" | "custom";

/** 과거에 저장됐지만 더 이상 신규 선택지에는 없는 값. 라벨 표시·수정 시 검증용으로만 남긴다. */
export type LegacyTimelineType = "career" | "system" | "achievement" | "attendance";

/** DB row의 timeline_type을 다룰 때 쓰는 합집합 타입 (저장값/렌더링 기준). */
export type AnyTimelineType = TimelineType | LegacyTimelineType;

/** Timeline 추가/수정 UI에 노출되는 선택지. career/system/achievement/attendance는 제외. */
export const TIMELINE_TYPE_OPTIONS: { value: TimelineType; label: string }[] = [
  { value: "join", label: "가입" },
  { value: "competition", label: "대회" },
  { value: "league", label: "리그" },
  { value: "custom", label: "기타" },
];

/** 화면 표시(라벨)에만 쓰는 legacy 값 매핑. 신규 선택지에는 포함하지 않는다. */
const LEGACY_TIMELINE_TYPE_LABELS: Record<LegacyTimelineType, string> = {
  career: "선수출신",
  system: "운영",
  achievement: "대회 입상",
  attendance: "출석",
};

export const TIMELINE_TYPE_VALUES = TIMELINE_TYPE_OPTIONS.map((o) => o.value);

export const LEGACY_TIMELINE_TYPE_VALUES = Object.keys(LEGACY_TIMELINE_TYPE_LABELS) as LegacyTimelineType[];

/** 신규 등록 시 검증 기준. legacy 값(career/system/achievement/attendance)은 통과하지 못한다. */
export function isValidTimelineType(value: string): value is TimelineType {
  return (TIMELINE_TYPE_VALUES as string[]).includes(value);
}

/** 기존 row가 legacy 값을 갖고 있는지 확인 (수정 시 검증·화면 표시에 사용). */
export function isLegacyTimelineType(value: string): value is LegacyTimelineType {
  return (LEGACY_TIMELINE_TYPE_VALUES as string[]).includes(value);
}

/** 신규 값 + legacy 값을 합쳐서 "이미 저장되어 있는 값으로서는 유효한가"를 검증. PUT(수정) 시 사용. */
export function isValidOrLegacyTimelineType(value: string): value is AnyTimelineType {
  return isValidTimelineType(value) || isLegacyTimelineType(value);
}

/** 신규 값 + legacy 값을 모두 라벨로 변환. 목록 표시는 항상 이 함수를 쓴다. */
export function timelineTypeLabel(value: string): string {
  const newOption = TIMELINE_TYPE_OPTIONS.find((o) => o.value === value);
  if (newOption) return newOption.label;
  if (isLegacyTimelineType(value)) return LEGACY_TIMELINE_TYPE_LABELS[value];
  return value;
}

// ─────────────────────────────────────────────────────────
// 대회 협회/구분 (member_timeline.association)
// ─────────────────────────────────────────────────────────

export type Association = "KATA" | "KATO" | "지역대회" | "지도자부" | "테린이대회" | "기타";

export const ASSOCIATION_OPTIONS: Association[] = ["KATA", "KATO", "지역대회", "지도자부", "테린이대회", "기타"];

export function isValidAssociation(value: string): value is Association {
  return (ASSOCIATION_OPTIONS as string[]).includes(value);
}

// ─────────────────────────────────────────────────────────
// 부서 (member_timeline.division) — association에 종속
// ─────────────────────────────────────────────────────────

/**
 * association별 division 선택지. 배열이 비어있으면(지도자부/테린이대회/기타)
 * division 선택 UI 자체를 숨기고 DB에는 null을 저장한다.
 */
export const DIVISION_OPTIONS_BY_ASSOCIATION: Record<Association, string[]> = {
  KATA: ["신인부", "오픈부", "개나리부", "국화부"],
  KATO: ["신인부", "오픈부", "개나리부", "국화부"],
  지역대회: ["개인전", "단체전"],
  지도자부: [],
  테린이대회: [],
  기타: [],
};

export function divisionOptionsFor(association: string): string[] {
  if (!isValidAssociation(association)) return [];
  return DIVISION_OPTIONS_BY_ASSOCIATION[association];
}

/** association에 division이 없는 경우(빈 배열)인지 확인 */
export function associationHasNoDivision(association: string): boolean {
  return divisionOptionsFor(association).length === 0;
}

export function isValidDivisionForAssociation(association: string, division: string | null): boolean {
  const options = divisionOptionsFor(association);
  if (options.length === 0) return division === null;
  return division !== null && options.includes(division);
}

// ─────────────────────────────────────────────────────────
// 결과 (member_timeline.result)
// ─────────────────────────────────────────────────────────

export const RESULT_OPTIONS = ["우승", "준우승", "공동3위", "입상", "8강", "16강", "참가"] as const;

export type TimelineResult = (typeof RESULT_OPTIONS)[number];

export function isValidResult(value: string): value is TimelineResult {
  return (RESULT_OPTIONS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────
// Timeline 화면 표시 헬퍼
// ─────────────────────────────────────────────────────────

export interface TimelineYearGroup<T> {
  year: string;
  items: T[];
}

/**
 * event_date 기준 연도별로 묶는다. event_date가 없는 항목("날짜 미상")은
 * 별도의 "날짜 미상" 그룹으로 묶어 맨 뒤에 둔다.
 * 입력은 이미 최신순으로 정렬되어 있다고 가정한다(API가 그렇게 내려줌) —
 * 이 함수는 순서를 바꾸지 않고 그룹 경계만 계산한다.
 */
export function groupTimelineByYear<T extends { event_date: string | null }>(
  items: T[]
): TimelineYearGroup<T>[] {
  const dated = items.filter((item) => item.event_date !== null);
  const undated = items.filter((item) => item.event_date === null);

  const groups: TimelineYearGroup<T>[] = [];
  for (const item of dated) {
    const year = item.event_date!.slice(0, 4);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.year === year) {
      lastGroup.items.push(item);
    } else {
      groups.push({ year, items: [item] });
    }
  }

  if (undated.length > 0) {
    groups.push({ year: "날짜 미상", items: undated });
  }

  return groups;
}
