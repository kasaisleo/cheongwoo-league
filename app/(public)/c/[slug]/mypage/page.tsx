import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import MyPageClient from "@/app/(public)/mypage/MyPageClient";

export const dynamic = "force-dynamic";

export default async function ClubMyPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnUrl=/c/${params.slug}/mypage`);

  const club = await requirePublicClubBySlug(params.slug);
  return <MyPageClient currentClubId={club.id} />;
}
