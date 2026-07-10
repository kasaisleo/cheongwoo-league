import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * /guests — legacy redirect wrapper.
 *
 * canonical route は /c/[slug]/guest.
 * selected_club_id 쿠키가 유효한 active club을 가리키면 해당 canonical route로 redirect.
 * 그 외(쿠키 없음/invalid) → / 로 fallback. DEFAULT_CLUB_ID fallback 금지.
 *
 * UI를 직접 렌더하지 않는다.
 */
export default async function LegacyGuestsPage() {
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
    if (club?.slug) redirect(`/c/${club.slug}/guest`);
  }

  redirect("/");
}
