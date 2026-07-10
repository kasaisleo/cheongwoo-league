import { requirePublicClubBySlug } from "@/lib/public-club";
import { GuestList } from "@/components/guest/GuestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /c/[slug]/guest — public canonical 게스트 목록.
 *
 * URL slug → requirePublicClubBySlug → club.id.
 * 이 club.id만을 GuestList에 전달 — 쿠키/DEFAULT_CLUB_ID 일절 사용하지 않는다.
 * inactive/존재하지 않는 slug → notFound() (requirePublicClubBySlug 내부).
 */
export default async function ClubGuestPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);

  return (
    <main className="px-4 pt-6 pb-28">
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">Guests</p>
        <h1 className="headline-kr text-3xl text-line-900">게스트 목록</h1>
      </header>

      <GuestList mode="public" clubId={club.id} />
    </main>
  );
}
