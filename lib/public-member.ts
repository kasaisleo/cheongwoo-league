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
  /** 2A-8D-4(0067): winner_team=D 참여 Match 수. */
  draws: number;
  /** 2A-8D-4(0067): wins + losses + draws. win_rate의 분모다. */
  total_matches: number;
}

/**
 * public.get_public_member_detail RPC(0036)의 반환 row.
 * 목록과 달리 is_dormant를 포함하지 않는다(상세 페이지에는 활동/휴면
 * 표시를 하지 않기로 함 — get_public_member_list와 projection이 의도적으로 다름).
 */
export type PublicMemberDetailRow = Omit<PublicMemberListRow, "is_dormant">;

/**
 * 2A-8D-4 전이 호환 — 0067 적용 전 RPC의 raw 응답 shape.
 *
 * Git push가 Vercel 배포를 자동 시작하므로 실제 순서는 "코드 배포 → 0067 적용"이다.
 * 그 사이에는 RPC가 draws / total_matches를 돌려주지 않는다. 정규화 이후 앱
 * 내부 타입(PublicMemberListRow)에서는 두 값이 필수 number이며,
 * undefined / null / NaN은 앱 안으로 전파되지 않는다.
 */
export type RawPublicMemberListRow = Omit<PublicMemberListRow, "draws" | "total_matches"> & {
  draws?: number | null;
  total_matches?: number | null;
};

export type RawPublicMemberDetailRow = Omit<PublicMemberDetailRow, "draws" | "total_matches"> & {
  draws?: number | null;
  total_matches?: number | null;
};

/**
 * 구 응답에는 무승부 정보 자체가 없으므로 draws = 0으로 보고 기존 win_rate를
 * 그대로 쓴다(두 값이 서로 모순되지 않는다). 신 응답이면 RPC 값을 그대로 쓴다.
 */
function normalizeStats<T extends { wins: number; losses: number; win_rate: number; draws?: number | null; total_matches?: number | null }>(
  row: T
): T & { draws: number; total_matches: number } {
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

export function normalizePublicMemberListRow(row: RawPublicMemberListRow): PublicMemberListRow {
  return normalizeStats(row);
}

export function normalizePublicMemberDetailRow(row: RawPublicMemberDetailRow): PublicMemberDetailRow {
  return normalizeStats(row);
}
