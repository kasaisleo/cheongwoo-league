import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { EventDetailPageClient } from "./EventDetailPageClient";

/**
 * /admin/events/[id] — Event 상세 + 기본 수정 + participant roster(0050/0052 Phase 2A-4A).
 *
 * club context는 access.clubId만 사용 — selected_club_id/getCurrentClubId() 금지.
 * 실제 event_id+club_id 검증은 API route(GET /api/admin/events/[id])가 수행한다 —
 * 여기서는 [id]만 클라이언트로 넘긴다.
 */
export default async function AdminEventDetailPage({ params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) redirect("/admin?reason=no_club");

  return <EventDetailPageClient eventId={params.id} />;
}
