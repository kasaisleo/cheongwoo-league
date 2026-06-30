import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ranking-query.ts — 랭킹 조회 공통 함수 (단일 정렬 로직 소스).
 *
 * 이 파일이 정렬 기준의 단일 진실 공급원(Single Source of Truth)입니다.
 * Home RankingTeaserCard / Ranking 페이지가 동일 함수를 사용해
 * 항상 같은 Top 3가 보장됩니다.
 *
 * ── 확정 정렬 기준 (2026-06-30) ──────────────────────────────
 * 1. league_point  DESC   — LP 높을수록 상위
 * 2. win_rate      DESC   — 승률 높을수록 상위
 * 3. wins          DESC   — 승수 많을수록 상위
 * 4. score_diff    DESC   — 누적 득점차 클수록 상위 (신규: 0018 migration)
 * 5. age           DESC NULLS LAST — 연장자 우선, null이면 최하위
 *
 * ── 필터 정책 ─────────────────────────────────────────────────
 * - is_active: true    삭제/비활성 회원 제외
 * - is_dormant: false  휴면 회원 제외 (현재 시즌 미참여자)
 *   → Home과 Ranking 페이지가 동일한 회원 풀을 사용
 *
 * ── score_diff 계산 방법 (DB view 0018_ranking_tiebreaker.sql) ──
 *   복식 경기 A팀: score_a - score_b
 *   복식 경기 B팀: score_b - score_a
 *   전체 참여 경기 합산, 경기 없으면 0
 */

export function applyRankingQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  limit?: number
) {
  let q = supabase
    .from("member_stats")
    .select("*")
    .eq("is_active",  true)
    .eq("is_dormant", false)
    // ─── 정렬 기준 1~4: DB ORDER BY ──────────────────────────────
    .order("league_point", { ascending: false })
    .order("win_rate",     { ascending: false })
    .order("wins",         { ascending: false })
    .order("score_diff",   { ascending: false })
    // ─── 정렬 기준 5: age DESC NULLS LAST ────────────────────────
    // Supabase JS의 .order()는 nullsFirst 옵션 지원
    .order("age", { ascending: false, nullsFirst: false });

  if (limit !== undefined) {
    q = q.limit(limit);
  }

  return q;
}
