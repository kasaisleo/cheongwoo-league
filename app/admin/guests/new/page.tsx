import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/admin-permissions";
import NewGuestPageClient from "./NewGuestPageClient";

/**
 * /admin/guests/new — 게스트 등록 canonical admin route.
 *
 * club_id는 admin_club_slug 쿠키 → access.clubId 경로로만 결정.
 * admin layout(AdminClubShell + AdminBottomNav)을 소유한다.
 */
export default async function AdminNewGuestPage() {
  const access = await requireAdminAccess();
  if (!access.clubId) redirect("/admin?reason=no_club");
  return <NewGuestPageClient currentClubId={access.clubId} />;
}
