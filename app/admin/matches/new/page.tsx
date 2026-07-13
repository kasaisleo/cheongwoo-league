import { notFound } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { NewMatchPageClient } from "./NewMatchPageClient";

/**
 * /admin/matches/new — 경기 결과 입력 (관리자 전용).
 *
 * 권한 게이트 자체는 상위 app/admin/matches/layout.tsx의 requireAdminAccess()가 처리한다.
 * 이 페이지는 club context만 담당한다 — access.clubId만 사용하고
 * selected_club_id/getCurrentClubId()/DEFAULT_CLUB_ID는 사용하지 않는다(cross-club 오염 방지).
 * clubId가 없으면(이론상 발생하지 않아야 하지만 방어적으로) 빈 문자열로 넘기지 않고
 * 명시적으로 404 처리한다.
 */
export default async function AdminNewMatchPage() {
  const access = await getAdminAccessServer();
  if (!access.clubId) {
    notFound();
  }
  return <NewMatchPageClient currentClubId={access.clubId} />;
}
