import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * public.get_public_point_history RPC(0034)의 반환 row 그대로.
 * Public 목록 페이지와 lib/member-activity.ts가 각자의 목적에 맞게
 * 이 타입을 가져다 쓴다 — 공통 조회 helper는 두지 않는다(두 호출부의
 * 반환 목적이 다름: 목록 vs 단일 회원 최근 N건).
 */
export interface PointHistoryRpcRow {
  id: string;
  match_id: string | null;
  member_id: string;
  member_name: string;
  point_before: number;
  point_after: number;
  point_change: number;
  reason: string;
  created_at: string;
  match_played_at: string | null;
  session_day: SessionDay | null;
  session_title: string | null;
}
