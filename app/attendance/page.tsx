import { getCurrentClubId } from "@/lib/current-club";
import AttendancePageClient from "./AttendancePageClient";

/**
 * /attendance — 서버 wrapper.
 *
 * 공개 페이지라 requireAdminAccess()/requireOwnerAccess() 같은 권한 guard는
 * 추가하지 않는다. selected_club_id 쿠키는 httpOnly라 클라이언트에서 직접
 * 읽을 수 없으므로 서버에서 getCurrentClubId()로 확보한 뒤 클라이언트
 * 컴포넌트에 prop으로 전달한다. 기존 UI/로직은 AttendancePageClient.tsx로
 * 그대로 옮겨졌다(Phase 3D-10C-2).
 */
export default async function AttendancePage() {
  const currentClubId = await getCurrentClubId();
  return <AttendancePageClient currentClubId={currentClubId} />;
}
