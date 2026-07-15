import type { MemberRole, MemberType } from "@/lib/supabase/database.types";

/**
 * public.get_public_member_list RPC(0036)의 반환 row.
 * Public 회원 목록/랭킹 전용 — phone/age/address_full/district/memo/
 * permission_role/auth_user_id/kakao_provider_id/is_kakao_linked/
 * deleted_at/created_at은 절대 포함하지 않는다.
 */
export interface PublicMemberListRow {
  id: string;
  name: string;
  nickname: string;
  wins: number;
  losses: number;
  league_point: number;
  member_type: MemberType;
  role: MemberRole | null;
  mapo_score: number | null;
  player_background: string;
  is_dormant: boolean;
  win_rate: number;
  score_diff: number;
}

/**
 * public.get_public_member_detail RPC(0036)의 반환 row.
 * 목록과 달리 is_dormant를 포함하지 않는다(상세 페이지에는 활동/휴면
 * 표시를 하지 않기로 함 — get_public_member_list와 projection이 의도적으로 다름).
 */
export type PublicMemberDetailRow = Omit<PublicMemberListRow, "is_dormant">;
