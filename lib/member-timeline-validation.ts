import {
  isValidTimelineType,
  isValidOrLegacyTimelineType,
  isValidAssociation,
  isValidDivisionForAssociation,
  isValidResult,
} from "@/lib/constants/member-timeline";

export const TIMELINE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface TimelinePayloadInput {
  timelineType: string;
  eventDate: string | null;
  title: string;
  association: string | null;
  division: string | null;
  result: string | null;
}

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
  if (body.eventDate !== null && !TIMELINE_DATE_REGEX.test(body.eventDate)) {
    return "날짜는 YYYY-MM-DD 형식이거나 비워둬야 합니다.";
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
