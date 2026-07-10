import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * /mypage — slug-based mypage로 redirect.
 *
 * selected_club_id 쿠키(OAuth 콜백에서 단일 클럽 사용자에게 설정)로
 * 클럽 slug를 조회해 /c/{slug}/mypage로 redirect한다.
 * 쿠키 없거나 클럽 미발견 시 플랫폼 홈(/)으로 fallback.
 * DEFAULT_CLUB_ID 하드코딩 금지.
 */
export default async function MyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnUrl=/mypage");

  const cookieStore = cookies();
  const selectedClubId = cookieStore.get("selected_club_id")?.value;

  if (selectedClubId) {
    const { data: club } = await supabase
      .from("clubs")
      .select("slug")
      .eq("id", selectedClubId)
      .eq("status", "active")
      .maybeSingle();
    if (club?.slug) redirect(`/c/${club.slug}/mypage`);
  }

  redirect("/");
}
