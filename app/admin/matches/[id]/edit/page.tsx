import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { EditMatchPageClient } from "./EditMatchPageClient";
import { getAdminAccessServer } from "@/lib/admin-permissions";

interface PageProps {
  params: { id: string };
}

export default async function EditMatchPage({ params }: PageProps) {
  const supabase = createClient();
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";

  const { data: raw } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("id", params.id)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (!raw) notFound();

  const matches = toDisplayMatches([raw]);
  const match = matches[0];
  if (!match) notFound();

  return <EditMatchPageClient match={match} currentClubId={currentClubId} />;
}
