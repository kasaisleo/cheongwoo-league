import { createClient } from "@/lib/supabase/server";
import { PlatformLandingClient } from "./PlatformLandingClient";
import type { Club } from "./PlatformLandingClient";

/**
 * SUPER MATCH — 플랫폼 메인 랜딩 (서버 컴포넌트)
 *
 * - clubs 테이블 active 클럽만 공개 조회, 이름 순 정렬
 * - getCurrentClubId / getCurrentClub / selected_club_id / DEFAULT_CLUB_ID 미사용
 * - 인증 없는 공개 페이지
 * - PlatformLandingClient가 fixed inset-0 z-[9999] 오버레이로
 *   root layout의 BrandHeader / MemberAuthBar / BottomTabBar를 완전 차단
 */
export const dynamic = "force-dynamic";

async function getActiveClubs(): Promise<Club[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, slug, description")
    .eq("status", "active")
    .order("name", { ascending: true });
  return data ?? [];
}

export default async function PlatformLandingPage() {
  const clubs = await getActiveClubs();
  return <PlatformLandingClient clubs={clubs} />;
}
