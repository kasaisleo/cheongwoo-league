import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ranking-query.ts — 랭킹 조회 공통 함수.
 *
 * 버그 원인 (발견: 2026-06-30):
 *   Home:    .eq("is_dormant", false) 적용 → 휴면 회원 제외
 *   Ranking: is_dormant 필터 없음        → 휴면 회원 포함
 *   → 동일 시점인데 Top 3가 다르게 표시되는 데이터 불일치 발생
 *
 * 수정 원칙:
 *   Home Current Rankings = Ranking Page Top 3 를 보장하려면
 *   동일한 필터 + 동일한 정렬 조건을 사용해야 한다.
 *
 * 확정 정책:
 *   - is_active: true   (삭제/비활성 회원 제외 — 양쪽 동일하게 적용)
 *   - is_dormant: false (휴면 회원 제외 — Ranking 페이지도 동일하게)
 *     근거: 휴면 회원은 현재 시즌에 참여하지 않으므로 랭킹 집계에서 제외
 *   - 정렬: league_point DESC → win_rate DESC → wins DESC
 *
 * 사용처:
 *   - app/page.tsx (Home RankingTeaserCard)
 *   - app/ranking/page.tsx (Ranking 페이지 전체)
 */

export const RANKING_QUERY_BASE = {
  table: "member_stats" as const,
  filters: {
    is_active: true,
    is_dormant: false,   // 휴면 회원 제외 — 양쪽 동일
  },
  orders: [
    { column: "league_point", ascending: false },
    { column: "win_rate",     ascending: false },
    { column: "wins",         ascending: false },
  ] as const,
};

/** Supabase 쿼리 빌더에 공통 랭킹 조건 적용 후 반환 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRankingQuery(supabase: SupabaseClient<any>, limit?: number) {
  let q = supabase
    .from(RANKING_QUERY_BASE.table)
    .select("*")
    .eq("is_active",  RANKING_QUERY_BASE.filters.is_active)
    .eq("is_dormant", RANKING_QUERY_BASE.filters.is_dormant)
    .order("league_point", { ascending: false })
    .order("win_rate",     { ascending: false })
    .order("wins",         { ascending: false });

  if (limit !== undefined) {
    q = q.limit(limit);
  }

  return q;
}
