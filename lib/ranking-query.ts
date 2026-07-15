import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ranking-query.ts 랭킹 조회 공통 함수.
 *
 * Home RankingTeaserCard / Ranking 페이지가 동일 함수를 사용해
 * 항상 같은 정렬 기준을 유지한다.
 *
 * get_public_member_list RPC(0036) 기반 — club_id/is_active=true/
 * deleted_at is null은 RPC가 이미 강제한다. is_dormant는 RPC가 필터링하지
 * 않으므로(회원 목록 화면의 활동/휴면 필터 유지 목적) 여기서 추가로
 * false만 남긴다.
 *
 * 정렬 기준(members P0 대응 Phase 2 — age가 Public projection에서 빠지며
 * 기존 age DESC NULLS LAST tie-breaker를 nickname/id로 교체):
 * 1. league_point DESC
 * 2. win_rate DESC
 * 3. wins DESC
 * 4. score_diff DESC
 * 5. nickname ASC
 * 6. id ASC
 */
export function applyRankingQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clubId: string,
  limit?: number
) {
  let q = supabase
    .rpc("get_public_member_list", { p_club_id: clubId })
    .eq("is_dormant", false)
    .order("league_point", { ascending: false })
    .order("win_rate", { ascending: false })
    .order("wins", { ascending: false })
    .order("score_diff", { ascending: false })
    .order("nickname", { ascending: true })
    .order("id", { ascending: true });

  if (limit !== undefined) {
    q = q.limit(limit);
  }

  return q;
}
