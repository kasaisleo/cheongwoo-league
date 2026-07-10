import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * /mypage — slug-based mypage로 redirect (compatibility route).
 *
 * 로그인 여부와 무관하게 selected_club_id 쿠키로 slug를 resolve해
 * /c/{slug}/mypage로 redirect한다. login gate는 /c/{slug}/mypage 내부에서
 * ClubMemberLoginGate가 담당하므로 여기서 /login으로 redirect하지 않는다.
 *
 * selected_club_id 없거나 slug 미발견 시 / 로 fallback.
 * DEFAULT_CLUB_ID 하드코딩 금지.
 */
export default async function MyPage() {
  const cookieStore = cookies();
  const selectedClubId = cookieStore.get("selected_club_id")?.value;

  if (selectedClubId) {
    const supabase = createClient();
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
