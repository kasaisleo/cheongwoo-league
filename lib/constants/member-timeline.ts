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
// ─────────────────────────────────────────────────────────

export type TimelineType =
  | "join"
  | "career"
  | "achievement"
  | "league"
  | "attendance"
  | "system"
  | "custom";

export const TIMELINE_TYPE_OPTIONS: { value: TimelineType; label: string }[] = [
  { value: "join", label: "가입" },
  { value: "career", label: "커리어" },
  { value: "achievement", label: "대회 입상" },
  { value: "league", label: "리그" },
  { value: "attendance", label: "출석" },
  { value: "system", label: "운영" },
  { value: "custom", label: "기타" },
];

export const TIMELINE_TYPE_VALUES = TIMELINE_TYPE_OPTIONS.map((o) => o.value);

export function isValidTimelineType(value: string): value is TimelineType {
  return (TIMELINE_TYPE_VALUES as string[]).includes(value);
}

export function timelineTypeLabel(value: string): string {
  return TIMELINE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
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
