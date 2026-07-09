import { getAdminAccessServer } from "@/lib/admin-permissions";
import { redirect } from "next/navigation";
import SettingsPageClient from "./SettingsPageClient";

/**
 * /admin/settings — 서버 wrapper.
 *
 * 권한 검증(requireOwnerAccess)은 layout.tsx가 담당한다.
 * club context는 admin_club_slug 쿠키 기준 access.clubId를 사용한다.
 * selected_club_id/getCurrentClubId() 사용 금지.
 */
export default async function AdminSettingsPage() {
  const access = await getAdminAccessServer();
  if (!access.clubId) redirect("/admin");
  return <SettingsPageClient currentClubId={access.clubId} />;
}
