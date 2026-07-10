import { getCurrentClubId } from "@/lib/current-club";
import { requireAdminAccess } from "@/lib/admin-permissions";
import NewGuestPageClient from "./NewGuestPageClient";

/**
 * /guests/new — 서버 wrapper.
 *
 * selected_club_id 쿠키는 httpOnly라 클라이언트에서 직접 읽을 수 없으므로,
 * 서버에서 getCurrentClubId()로 확보한 뒤 클라이언트 컴포넌트에 prop으로 전달한다.
 * 기존 폼/제출/UI 로직은 NewGuestPageClient.tsx로 그대로 옮겨졌다(Phase 3D-5).
 *
 * 권한: requireAdminAccess() — middleware의 cw_admin_session 단독 체크를
 * 대신해 이 페이지에서 직접 검증한다(Phase 3D-5B-1). 카카오 기반 관리자도
 * 정상 통과하도록 middleware의 PROTECTED_PREFIXES에서 이 경로를 제외했다.
 */
export default async function NewGuestPage() {
  await requireAdminAccess();
  const currentClubId = await getCurrentClubId();
  return <NewGuestPageClient currentClubId={currentClubId} />;
}
