import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { MemberList } from "@/components/member/MemberList";
import { PublicShell, ClubPageHeader } from "@/components/shell";
import type { MemberWithStats } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function ClubMembersPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);

  const supabase = createClient();
  const { data } = await supabase
    .from("member_stats")
    .select("*")
    .eq("is_active", true)
    .eq("club_id", club.id)
    .order("league_point", { ascending: false })
    .order("nickname");

  const members = (data ?? []) as MemberWithStats[];

  return (
    <PublicShell>
      <ClubPageHeader
        eyebrow="Club Roster"
        title="선수 명단"
        rightSlot={
          <Link
            href={`/c/${slug}`}
            className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700"
          >
            ← {club.name}
          </Link>
        }
      />
      <MemberList members={members} />
    </PublicShell>
  );
}
