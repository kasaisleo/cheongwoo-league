import type { SupabaseClient } from "@supabase/supabase-js";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

/**
 * ranking-query.ts 랭킹 조회 공통 함수.
 *
 * Home RankingTeaserCard / Ranking 페이지가 동일 함수를 사용해
 * 항상 같은 정렬 기준을 유지한다.
 *
 * 정렬 기준:
 * 1. league_point DESC
 * 2. win_rate DESC
 * 3. wins DESC
 * 4. score_diff DESC
 * 5. age DESC NULLS LAST
 *
 * 필터 기준:
 * - club_id: 기본값으로 청우회 club_id만 조회
 * - is_active: true
 * - is_dormant: false
 */
export function applyRankingQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  limit?: number,
  clubId: string = CHEONGWOO_CLUB_ID
) {
  let q = supabase
    .from("member_stats")
    .select("*")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .eq("is_dormant", false)
    .order("league_point", { ascending: false })
    .order("win_rate", { ascending: false })
    .order("wins", { ascending: false })
    .order("score_diff", { ascending: false })
    .order("age", { ascending: false, nullsFirst: false });

  if (limit !== undefined) {
    q = q.limit(limit);
  }

  return q;
}