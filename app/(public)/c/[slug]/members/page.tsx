import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { MemberList } from "@/components/member/MemberList";
import { PublicShell, ClubPageHeader } from "@/components/shell";
import type { PublicMemberListRow } from "@/lib/public-member";

export const dynamic = "force-dynamic";

export default async function ClubMembersPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);

  const supabase = createClient();
  const { data } = await supabase
    .rpc("get_public_member_list", { p_club_id: club.id })
    .order("league_point", { ascending: false })
    .order("nickname");

  const members = (data ?? []) as PublicMemberListRow[];

  return (
    <PublicShell>
      <ClubPageHeader
        eyebrow="Club Roster"
        title="선수 명단"
        rightSlot={
          <Link href={`/c/${slug}`} className="club-back-link mt-1">
            ← 클럽 홈
          </Link>
        }
      />
      <MemberList members={members} slug={slug} />
    </PublicShell>
  );
}
