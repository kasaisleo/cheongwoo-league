import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * public.get_public_point_history RPC(0034)의 반환 row 그대로.
 * point_history P0 Phase 2(0043)에서 get_public_point_history_v2로 소비처가
 * 전환되어 현재 앱 코드에서는 더 이상 사용하지 않는다 — v1 RPC 자체는 DB에
 * 아직 남아있고(최종 잠금 단계에서 EXECUTE revoke + 제거 예정) 그 반환 shape을
 * 문서화하기 위해 타입만 유지한다. 신규 코드에서 참조하지 말 것.
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

/**
 * public.get_public_point_history_v2 RPC(0043)의 반환 row 그대로.
 * v1과 달리 id/match_id/member_id/club_id raw UUID를 전혀 포함하지 않는다.
 * 같은 경기에 대한 변동을 그룹화해야 하는 회원 상세 화면을 위해
 * match_group_token(비가역 토큰, club_id+match_id 기반 해시)만 제공한다.
 */
export interface PointHistoryV2RpcRow {
  member_name: string;
  point_before: number;
  point_after: number;
  point_change: number;
  reason: string;
  created_at: string;
  match_played_at: string | null;
  session_day: SessionDay | null;
  session_title: string | null;
  match_group_token: string | null;
}
