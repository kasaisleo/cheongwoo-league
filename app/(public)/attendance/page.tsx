import { getCurrentClub } from "@/lib/current-club";
import AttendancePageClient from "./AttendancePageClient";

/**
 * /attendance — 서버 wrapper.
 *
 * 공개 페이지라 requireAdminAccess()/requireOwnerAccess() 같은 권한 guard는
 * 추가하지 않는다. selected_club_id 쿠키는 httpOnly라 클라이언트에서 직접
 * 읽을 수 없으므로 서버에서 getCurrentClub()으로 확보한 뒤 클라이언트
 * 컴포넌트에 prop으로 전달한다. 기존 UI/로직은 AttendancePageClient.tsx로
 * 그대로 옮겨졌다(Phase 3D-10C-2).
 *
 * clubSlug: guest CTA(PublicKakaoLoginButton)가 clubSlug를 필수로 요구하므로
 * 여기서도 함께 전달한다 — id만 있던 이전 버전은 로그인 버튼을 만들 수 없었다.
 */
export default async function AttendancePage() {
  const currentClub = await getCurrentClub();
  return <AttendancePageClient currentClubId={currentClub.id} clubSlug={currentClub.slug} />;
}
