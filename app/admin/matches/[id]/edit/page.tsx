import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { EditMatchPageClient } from "./EditMatchPageClient";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * /admin/matches/[id]/edit — 경기 수정 페이지 (서버 컴포넌트).
 *
 * 권한: layout.tsx requireAdminAccess() 가 서버에서 선처리.
 * 데이터: match id로 서버에서 조회 후 클라이언트 편집 UI로 전달.
 */
interface PageProps {
  params: { id: string };
}

export default async function EditMatchPage({ params }: PageProps) {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();

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

  return <EditMatchPageClient match={match} />;
}
