import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { EditMatchPageClient } from "./EditMatchPageClient";
import { requireAdminAccess } from "@/lib/admin-permissions";

interface PageProps {
  params: { id: string };
}

export default async function EditMatchPage({ params }: PageProps) {
  const access = await requireAdminAccess();
  if (!access.clubId) redirect("/admin?reason=no_club");
  const currentClubId = access.clubId;

  // MATCH_SELECT_WITH_PLAYERS가 members/guests를 임베드 조회하므로
  // service-role 필요(0037 members 락다운 + guests P0).
  const { data: raw, error } = await createServiceClient()
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("id", params.id)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (error) {
    // notFound()로 위장하지 않는다 — 조회 실패와 "존재하지 않는 매치"는 다른 상태다.
    console.error("[admin/matches/edit]", error.code, error.message);
    return (
      <main className="px-4 pt-6 text-center">
        <p className="text-sm" style={{ color: "var(--admin-muted)" }}>
          매치 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      </main>
    );
  }
  if (!raw) notFound();

  const matches = toDisplayMatches([raw]);
  const match = matches[0];
  if (!match) notFound();

  return <EditMatchPageClient match={match} currentClubId={currentClubId} />;
}
