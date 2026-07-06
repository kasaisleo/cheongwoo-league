import { getCurrentClubId } from "@/lib/current-club";
import AuthLinkPageClient from "./AuthLinkPageClient";

/**
 * /admin/auth-link — 서버 wrapper.
 *
 * 권한 검증(requireAdminAccess)은 app/admin/auth-link/layout.tsx가 이미
 * 담당한다. 이 파일은 여기서 중복 호출하지 않고, selected_club_id 쿠키는
 * httpOnly라 클라이언트에서 직접 읽을 수 없으므로 서버에서
 * getCurrentClubId()로 확보한 뒤 클라이언트 컴포넌트에 prop으로 전달한다.
 * 기존 UI/로직은 AuthLinkPageClient.tsx로 그대로 옮겨졌다(Phase 3D-10E).
 */
export default async function AuthLinkPage() {
  const currentClubId = await getCurrentClubId();
  return <AuthLinkPageClient currentClubId={currentClubId} />;
}
