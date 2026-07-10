import { redirect } from "next/navigation";

/**
 * /attendance/history는 기록 영역으로 이동.
 * IA 기준: 매치 히스토리는 기록(Records) 하위 라우트로 재배치.
 */
export default function AttendanceHistoryRedirect() {
  redirect("/matches/history");
}
