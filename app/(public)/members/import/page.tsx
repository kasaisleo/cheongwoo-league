import { requireOwnerAccess } from "@/lib/admin-permissions";
import MemberImportPageClient from "./MemberImportPageClient";

/**
 * /members/import — 서버 wrapper.
 *
 * middleware의 cw_admin_session 단독 체크를 대신해, 이 페이지에서
 * requireOwnerAccess()로 직접 검증한다(Phase 3D-5B-2 2차). 카카오 기반
 * owner도 정상 통과한다. 기존 업로드/staging/commit 로직은
 * MemberImportPageClient.tsx로 그대로 옮겨졌다.
 *
 * 참고: app/api/members/import/staging/route.ts(GET)는 아직 legacy
 * requireRole("owner")(쿠키 전용)를 쓰고 있어, 카카오 전용 owner가 이
 * 페이지에는 들어와도 목록 조회에서 막힐 수 있다 — 별도 Phase(3D-5B-3)에서 처리.
 */
export default async function MemberImportPage() {
  await requireOwnerAccess();

  return <MemberImportPageClient />;
}
