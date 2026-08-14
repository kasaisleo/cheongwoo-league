import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { MemberList } from "@/components/member/MemberList";
import { PublicShell, ClubPageHeader } from "@/components/shell";
import { normalizePublicMemberListRow, type PublicMemberListRow, type RawPublicMemberListRow } from "@/lib/public-member";

export const dynamic = "force-dynamic";

export default async function ClubMembersPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);

  const supabase = createClient();
  const { data } = await supabase
    .rpc("get_public_member_list", { p_club_id: club.id })
    .order("league_point", { ascending: false })
    .order("nickname");

  // 2A-8D-4: 0067 적용 전 RPC 응답에는 draws / total_matches가 없다.
  // RPC 경계에서 정규화해 앱 내부로는 필수 number만 흘린다.
  const members: PublicMemberListRow[] = (data ?? []).map((r: RawPublicMemberListRow) => normalizePublicMemberListRow(r));

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
