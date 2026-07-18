/**
 * public.get_public_guest_list RPC(0038)의 반환 row.
 * Public 게스트 목록 전용 — phone/notes/referred_by/age/years_playing/
 * skill_grade/manner_score/reinvite/created_at/club_id와
 * converted_to_member_id(uuid 자체)·소개자/전환회원 닉네임은 절대 포함하지 않는다.
 */
export interface PublicGuestListRow {
  id: string;
  name: string;
  visit_date: string;
  wins: number;
  losses: number;
  win_rate: number;
  is_active: boolean;
  is_converted: boolean;
}
