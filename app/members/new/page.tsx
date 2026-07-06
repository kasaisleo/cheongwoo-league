import { requireAdminAccess } from "@/lib/admin-permissions";
import NewMemberPageClient from "./NewMemberPageClient";

/**
 * /members/new — 서버 wrapper.
 *
 * middleware의 cw_admin_session 단독 체크를 대신해, 이 페이지에서
 * requireAdminAccess()로 직접 검증한다(Phase 3D-5B-2). 카카오 기반
 * 관리자도 정상 통과한다. 기존 폼/제출/UI 로직은 NewMemberPageClient.tsx로
 * 그대로 옮겨졌다.
 */
export default async function NewMemberPage() {
  await requireAdminAccess();

  return <NewMemberPageClient />;
}
