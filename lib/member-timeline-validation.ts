import {
  isValidTimelineType,
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

/** Timeline 등록/수정 공통 검증. 문제 있으면 에러 메시지, 없으면 null. */
export function validateTimelinePayload(body: TimelinePayloadInput): string | null {
  if (!isValidTimelineType(body.timelineType)) {
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
