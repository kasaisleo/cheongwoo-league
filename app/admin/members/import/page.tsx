import { requireOwnerAccess } from "@/lib/admin-permissions";
import MemberImportPageClient from "./MemberImportPageClient";

/**
 * /admin/members/import — 회원 명단 가져오기 (Owner 전용).
 *
 * 기존 (public)/members/import에서 이전(canonical route 정리) — 이 화면은
 * 애초에 Public 기능이 아니라 Admin 대시보드 "관리 도구"에서만 진입하는
 * 완전한 Admin 전용 기능이었다. upload/staging/commit API는 이미
 * access.clubId(admin_club_slug 쿠키) 기준으로만 동작해 cross-club 위험은
 * 없었다 — 이번 이동은 route 위치와 shell만 Admin 기준으로 맞추는 작업이다.
 */
export default async function MemberImportPage() {
  await requireOwnerAccess();

  return <MemberImportPageClient />;
}
