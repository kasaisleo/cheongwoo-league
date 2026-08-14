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
  /** 2A-8D-4(0067): winner_team=D 참여 Match 수. */
  draws: number;
  /** 2A-8D-4(0067): wins + losses + draws. win_rate의 분모다. */
  total_matches: number;
  is_active: boolean;
  is_converted: boolean;
}

/**
 * 2A-8D-4 전이 호환 — 0067 적용 전 RPC의 raw 응답 shape.
 * 정규화 이후 PublicGuestListRow에서는 draws / total_matches가 필수 number다.
 */
export type RawPublicGuestListRow = Omit<PublicGuestListRow, "draws" | "total_matches"> & {
  draws?: number | null;
  total_matches?: number | null;
};

export function normalizePublicGuestRow(row: RawPublicGuestListRow): PublicGuestListRow {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const wins = num(row.wins, 0);
  const losses = num(row.losses, 0);
  const draws = num(row.draws, 0);
  return {
    ...row,
    wins,
    losses,
    win_rate: num(row.win_rate, 0),
    draws,
    total_matches: num(row.total_matches, wins + losses + draws),
  };
}
