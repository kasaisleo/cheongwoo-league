import type { AttendanceSession } from "@/lib/supabase/database.types";

/**
 * 출석체크/경기입력/경기기록/경기수정/메인 화면이 공통으로 쓰는 세션 표시명.
 * 화면마다 다른 명칭을 쓰지 않고, 어디서든 이 매핑 하나만 사용한다.
 * DB의 session_day 값(custom)은 그대로 두고, 화면 표시만 "이벤트매치"로 통일한다.
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

/**
 * 출석체크 화면과 경기입력 화면이 공통으로 쓰는 세션 목록 조회 함수.
 *
 * 공통 규칙:
 * - 기준 테이블: attendance_sessions
 * - 노출 조건: status IN ('open', 'closed')  — archived는 기본 목록에서 제외
 * - 정렬: session_date ASC
 *
 * 두 화면이 각자 다른 조건으로 따로 조회하던 것을 이 함수로 통일한다.
 */
export async function fetchActiveSessions(supabase: any): Promise<AttendanceSession[]> {
  const { data } = await supabase
    .from("attendance_sessions")
    .select("*")
    .in("status", ["open", "closed"])
    .order("session_date", { ascending: true });

  return (data ?? []) as AttendanceSession[];
}
