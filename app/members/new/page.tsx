import { requireAdminAccess } from "@/lib/admin-permissions";
import { getCurrentClubId } from "@/lib/current-club";
import NewMemberPageClient from "./NewMemberPageClient";

/**
 * /members/new — 서버 wrapper.
 *
 * middleware의 cw_admin_session 단독 체크를 대신해, 이 페이지에서
 * requireAdminAccess()로 직접 검증한다(Phase 3D-5B-2). 카카오 기반
 * 관리자도 정상 통과한다. 기존 폼/제출/UI 로직은 NewMemberPageClient.tsx로
 * 그대로 옮겨졌다.
 *
 * currentClubId는 selected_club_id 쿠키(httpOnly)를 클라이언트가 직접
 * 읽을 수 없으므로 서버에서 확보해 prop으로 내려준다(Phase 3D-6-2A).
 */
export default async function NewMemberPage() {
  await requireAdminAccess();
  const currentClubId = await getCurrentClubId();

  return <NewMemberPageClient currentClubId={currentClubId} />;
}
