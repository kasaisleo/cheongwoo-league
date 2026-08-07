import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { NewEventPageClient } from "./NewEventPageClient";

/**
 * /admin/events/new — Event 생성(0050 Phase 2A-4A).
 *
 * selected_club_id/getCurrentClubId()/DEFAULT_CLUB_ID는 사용하지 않는다
 * (cross-club 오염 방지) — access.clubId만 사용.
 */
export default async function AdminNewEventPage() {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) redirect("/admin?reason=no_club");

  return <NewEventPageClient />;
}
