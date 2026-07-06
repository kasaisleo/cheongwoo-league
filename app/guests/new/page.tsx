import { getCurrentClubId } from "@/lib/current-club";
import NewGuestPageClient from "./NewGuestPageClient";

/**
 * /guests/new — 서버 wrapper.
 *
 * selected_club_id 쿠키는 httpOnly라 클라이언트에서 직접 읽을 수 없으므로,
 * 서버에서 getCurrentClubId()로 확보한 뒤 클라이언트 컴포넌트에 prop으로 전달한다.
 * 기존 폼/제출/UI 로직은 NewGuestPageClient.tsx로 그대로 옮겨졌다(Phase 3D-5).
 */
export default async function NewGuestPage() {
  const currentClubId = await getCurrentClubId();
  return <NewGuestPageClient currentClubId={currentClubId} />;
}
