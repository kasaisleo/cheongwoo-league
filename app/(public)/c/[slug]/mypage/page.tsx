import { requirePublicClubBySlug } from "@/lib/public-club";
import MyPageClient from "@/app/(public)/mypage/MyPageClient";

export const dynamic = "force-dynamic";

/**
 * /c/[slug]/mypage — club-skinned 마이페이지.
 *
 * 서버 auth redirect 제거: 비로그인 시 MyPageClient가 club skin 안에서
 * login gate를 직접 렌더링한다. 서버 redirect는 [data-club-skin] wrapper를
 * DOM에서 제거해 BrandHeader/BottomTabBar의 skin을 무력화하는 문제가 있었음.
 */
export default async function ClubMyPage({
  params,
}: {
  params: { slug: string };
}) {
  const club = await requirePublicClubBySlug(params.slug);
  return <MyPageClient currentClubId={club.id} slug={params.slug} />;
}
