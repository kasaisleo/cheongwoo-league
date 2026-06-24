import type { AttendanceSession } from "@/lib/supabase/database.types";

/**
 * 경기 관련 화면(경기입력/경기기록/경기수정)에서 쓰는 세션 표시명.
 * 출석 화면의 표시명("토요 정기운동" 등)과는 다른 명칭을 쓴다 — 경기 맥락에서는
 * "매치"라는 단어를 사용한다. DB의 session_day 값(custom)은 그대로 두고,
 * 화면 표시만 "이벤트매치"로 통일한다(과거 "임시운동"/"temporary" 표현 대체).
 */
export const MATCH_SESSION_DAY_LABEL: Record<AttendanceSession["session_day"], string> = {
  saturday: "토요정기매치",
  sunday: "일요정기매치",
  holiday: "휴일매치",
  custom: "이벤트매치",
};

/** 경기 기록 페이지의 세션 타입 필터 탭에 쓰는 순서 고정 목록 */
export const MATCH_SESSION_DAY_FILTERS: { value: AttendanceSession["session_day"]; label: string }[] = [
  { value: "saturday", label: MATCH_SESSION_DAY_LABEL.saturday },
  { value: "sunday", label: MATCH_SESSION_DAY_LABEL.sunday },
  { value: "holiday", label: MATCH_SESSION_DAY_LABEL.holiday },
  { value: "custom", label: MATCH_SESSION_DAY_LABEL.custom },
];
