import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SELECTED_CLUB_COOKIE } from "@/lib/club-constants";

/**
 * /members — legacy redirect wrapper.
 *
 * selected_club_id 쿠키가 있을 때만 canonical URL로 redirect한다.
 * 쿠키 없음 / 클럽 inactive / DB 오류 → / 로 이동.
 *
 * DEFAULT_CLUB_ID 자동 fallback 금지: 쿠키 없는 Namaste 사용자를
 * /c/cheongwoo/members 로 잘못 redirect하는 사고를 막기 위함.
 */

export default async function LegacyMembersPage() {
  const cookieStore = cookies();
  const clubId = cookieStore.get(SELECTED_CLUB_COOKIE)?.value;
  if (!clubId) redirect("/");

  const supabase = createClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("slug, status")
    .eq("id", clubId)
    .maybeSingle();

  if (!club || club.status !== "active" || !club.slug) redirect("/");
  redirect(`/c/${club.slug}/members`);
}
