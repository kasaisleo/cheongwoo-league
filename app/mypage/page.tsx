import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClubId } from "@/lib/current-club";
import MyPageClient from "./MyPageClient";

/**
 * /mypage — 서버 wrapper.
 *
 * requireAdminAccess() 같은 관리자 권한 guard는 필요 없지만(일반 로그인
 * 회원이면 누구나 접근), 본인 정보를 다루는 페이지라 로그인은 서버에서
 * 확인한다(QA-P0-B, /members와 동일 패턴). selected_club_id 쿠키는
 * httpOnly라 클라이언트에서 직접 읽을 수 없으므로 서버에서
 * getCurrentClubId()로 확보한 뒤 클라이언트 컴포넌트에 프롭으로
 * 전달한다. 기존 UI/로직은 MyPageClient.tsx로 그대로 옮겨졌다(Phase 3D-10E).
 */
export default async function MyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnUrl=/mypage");

  const currentClubId = await getCurrentClubId();
  return <MyPageClient currentClubId={currentClubId} />;
}
