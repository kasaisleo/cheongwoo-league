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
 * - club_id: 호출부에서 전달한 clubId 기준으로 조회
 *
 * 두 화면이 각자 다른 조건으로 따로 조회하던 것을 이 함수로 통일한다.
 */
export async function fetchActiveSessions(
  supabase: any,
  clubId: string
): Promise<AttendanceSession[]> {
  const { data } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("club_id", clubId)
    .in("status", ["open", "closed"])
    .order("session_date", { ascending: true });

  return (data ?? []) as AttendanceSession[];
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 로컬 기준 오늘이 속한 주(월~일)의 시작/끝 날짜 문자열 */
function thisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0(일)~6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/**
 * 메인 화면에 노출할 세션을 골라 정렬한다.
 *
 * 노출 조건: status IN ('open','closed') AND session_date >= 오늘 (archived 제외 — 이미 위 조건에서 자동 제외됨)
 * 정렬 우선순위:
 *   1. 이번 주 토요정기매치
 *   2. 이번 주 일요정기매치
 *   3. 그 외 휴일/이벤트매치는 오늘 기준 가까운 날짜순
 *   4. 다음 주 이후 정기매치
 */
export function selectHomeSessions(sessions: AttendanceSession[]): AttendanceSession[] {
  const today = todayDateString();
  const week = thisWeekRange();

  const upcoming = sessions.filter((s) => s.session_date >= today);

  function priority(session: AttendanceSession): number {
    const isThisWeek = session.session_date >= week.start && session.session_date <= week.end;
    if (isThisWeek && session.session_day === "saturday") return 0;
    if (isThisWeek && session.session_day === "sunday") return 1;
    if (session.session_day === "holiday" || session.session_day === "custom") return 2;
    return 3; // 다음 주 이후 정기매치
  }

  return [...upcoming].sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.session_date.localeCompare(b.session_date);
  });
}