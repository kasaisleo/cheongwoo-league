/** lib/records/attendanceStatus.ts
 * 출석 체크 검수 상태 판단 순수 함수.
 * page.tsx named export 제약을 피하기 위해 별도 파일로 분리.
 */

export type AttendanceCheckStatus =
  | "완료 전"
  | "체크 양호"
  | "확인 필요"
  | "응답 부족";

export interface AttendanceStatusInput {
  isCompleted: boolean;
  totalMembers: number;       // 전체 활성 회원 수
  attendingCount: number;     // 출석
  undecidedCount: number;     // 미정
  absentCount: number;        // 불참
  noResponseCount: number;    // 미응답 (totalMembers - 응답자 수)
  noShowCount: number;        // 출석 후 미참여
}

/**
 * 출석 체크 검수 상태 판단.
 * 우선순위: 완료 전 > 응답 부족 > 확인 필요 > 체크 양호
 */
export function judgeAttendanceStatus(s: AttendanceStatusInput): AttendanceCheckStatus {
  if (!s.isCompleted) return "완료 전";

  const respondedCount = s.attendingCount + s.undecidedCount + s.absentCount;
  const attendanceRate = s.totalMembers > 0
    ? Math.round((respondedCount / s.totalMembers) * 100)
    : 0;

  if (attendanceRate < 50) return "응답 부족";
  if (s.noShowCount > 0) return "확인 필요";
  if (s.noResponseCount > s.attendingCount + s.undecidedCount + s.absentCount) return "확인 필요";
  return "체크 양호";
}

export const ATTENDANCE_STATUS_STYLE: Record<AttendanceCheckStatus, string> = {
  "체크 양호": "border-gold/40 bg-gold/10 text-gold",
  "확인 필요": "border-clay-400/40 bg-clay-400/10 text-clay-400",
  "응답 부족": "border-line-200/40 bg-line-200/40 text-line-500",
  "완료 전":  "border-line-200/40 bg-line-50 text-line-400",
};
