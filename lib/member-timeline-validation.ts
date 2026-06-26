import {
  isValidTimelineType,
  isValidOrLegacyTimelineType,
  isValidAssociation,
  isValidDivisionForAssociation,
  isValidResult,
} from "@/lib/constants/member-timeline";

export interface TimelinePayloadInput {
  timelineType: string;
  /** 연도. 정책상 필수 — null이면 "날짜를 전혀 모르는" 경우로만 허용(연도 없이 월만 있는 것은 불가). */
  eventYear: number | null;
  /** 월(1~12). 선택값 — 모르면 null. eventYear가 null이면 eventMonth도 반드시 null이어야 한다. */
  eventMonth: number | null;
  title: string;
  association: string | null;
  division: string | null;
  result: string | null;
}

export const TIMELINE_YEAR_MIN = 1900;
export const TIMELINE_YEAR_MAX = 2100;

export interface ValidateTimelinePayloadOptions {
  /**
   * true면 timeline_type에 legacy 값(career/system/achievement/attendance)도
   * 허용한다. 기존 row를 PUT으로 수정할 때 종류를 그대로 두고 다른 필드만
   * 바꾸는 경우가 흔한데, 신규 등록 기준(isValidTimelineType)만으로 검증하면
   * 이런 평범한 수정조차 막혀버린다. 신규 생성(POST)에는 절대 true를 넘기지
   * 않아야 새 legacy row가 더 늘어나는 것을 막을 수 있다.
   */
  allowLegacyType?: boolean;
}

/** Timeline 등록/수정 공통 검증. 문제 있으면 에러 메시지, 없으면 null. */
export function validateTimelinePayload(
  body: TimelinePayloadInput,
  options: ValidateTimelinePayloadOptions = {}
): string | null {
  const typeIsValid = options.allowLegacyType
    ? isValidOrLegacyTimelineType(body.timelineType)
    : isValidTimelineType(body.timelineType);
  if (!typeIsValid) {
    return "타임라인 종류가 올바르지 않습니다.";
  }
  if (!body.title?.trim()) {
    return "제목을 입력해주세요.";
  }
  if (body.eventYear !== null) {
    if (!Number.isInteger(body.eventYear) || body.eventYear < TIMELINE_YEAR_MIN || body.eventYear > TIMELINE_YEAR_MAX) {
      return `연도는 ${TIMELINE_YEAR_MIN}~${TIMELINE_YEAR_MAX} 사이여야 합니다.`;
    }
  } else if (body.eventMonth !== null) {
    // 연도 없이 월만 있는 입력은 의미가 모호해서 허용하지 않는다 — "몇 년도 7월인지"를 알 수 없다.
    return "월을 입력하려면 연도를 함께 입력해야 합니다.";
  }
  if (body.eventMonth !== null) {
    if (!Number.isInteger(body.eventMonth) || body.eventMonth < 1 || body.eventMonth > 12) {
      return "월은 1~12 사이여야 합니다.";
    }
  }
  if (body.association !== null) {
    if (!isValidAssociation(body.association)) {
      return "대회 구분이 올바르지 않습니다.";
    }
    if (!isValidDivisionForAssociation(body.association, body.division)) {
      return "부서 선택이 대회 구분과 맞지 않습니다.";
    }
  } else if (body.division !== null) {
    return "대회 구분 없이 부서만 선택할 수 없습니다.";
  }
  if (body.result !== null && !isValidResult(body.result)) {
    return "대회 결과가 올바르지 않습니다.";
  }
  return null;
}

/**
 * event_year/event_month로부터 호환용 event_date 컬럼 값을 합성한다.
 * 정렬·그룹화 로직이 event_date(텍스트, "YYYY-MM-DD")에 의존하므로, day는
 * 항상 "01"로 고정한 placeholder다 — 실제 날짜가 1일이라는 의미가 아니다.
 * 화면 표시나 "월을 아는지" 판단에는 이 값을 절대 쓰지 않고 event_year/
 * event_month를 직접 사용해야 한다.
 */
export function buildEventDate(eventYear: number | null, eventMonth: number | null): string | null {
  if (eventYear === null) return null;
  const month = eventMonth ?? 1;
  return `${eventYear}-${String(month).padStart(2, "0")}-01`;
}
