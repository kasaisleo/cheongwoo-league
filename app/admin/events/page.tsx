import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { EventsPageClient } from "./EventsPageClient";

/**
 * /admin/events — Event 목록(0050/0052 Phase 2A-4A).
 *
 * club context는 access.clubId만 사용한다 — selected_club_id/getCurrentClubId()
 * 사용 금지(cross-club 오염 방지).
 */
export default async function AdminEventsPage() {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) redirect("/admin?reason=no_club");

  return <EventsPageClient currentClubId={access.clubId} />;
}
