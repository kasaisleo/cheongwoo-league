import type { MatchPlayerDisplay, SessionDay } from "@/lib/supabase/database.types";

/**
 * matches 조회 시 사용할 select 문자열.
 * 각 선수 슬롯은 member 또는 guest 중 하나만 채워지므로 둘 다 조회해서 화면에서 합쳐 쓴다.
 * session_id로 attendance_sessions를 조인해서 세션 구분(session_day)/제목도 함께 가져온다.
 */
export const MATCH_SELECT_WITH_PLAYERS = `
  id, played_at, session_id, score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team, created_at,
  session:attendance_sessions!matches_session_id_fkey(session_day, title),
  team_a_player1_member_row:members!matches_team_a_player1_member_fkey(id, nickname),
  team_a_player1_guest_row:guests!matches_team_a_player1_guest_fkey(id, name),
  team_a_player2_member_row:members!matches_team_a_player2_member_fkey(id, nickname),
  team_a_player2_guest_row:guests!matches_team_a_player2_guest_fkey(id, name),
  team_b_player1_member_row:members!matches_team_b_player1_member_fkey(id, nickname),
  team_b_player1_guest_row:guests!matches_team_b_player1_guest_fkey(id, name),
  team_b_player2_member_row:members!matches_team_b_player2_member_fkey(id, nickname),
  team_b_player2_guest_row:guests!matches_team_b_player2_guest_fkey(id, name)
`;

interface RawSlot {
  id: string;
  nickname?: string;
  name?: string;
}

interface RawSessionInfo {
  session_day: SessionDay;
  title: string;
}

interface RawMatchRow {
  id: string;
  played_at: string;
  session_id: string | null;
  session: RawSessionInfo | null;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: "A" | "B";
  created_at: string;
  team_a_player1_member_row: RawSlot | null;
  team_a_player1_guest_row: RawSlot | null;
  team_a_player2_member_row: RawSlot | null;
  team_a_player2_guest_row: RawSlot | null;
  team_b_player1_member_row: RawSlot | null;
  team_b_player1_guest_row: RawSlot | null;
  team_b_player2_member_row: RawSlot | null;
  team_b_player2_guest_row: RawSlot | null;
}

export interface DisplayMatch {
  id: string;
  played_at: string;
  session_id: string | null;
  sessionDay: SessionDay | null;
  sessionTitle: string | null;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: "A" | "B";
  created_at: string;
  teamAPlayer1: MatchPlayerDisplay;
  teamAPlayer2: MatchPlayerDisplay;
  teamBPlayer1: MatchPlayerDisplay;
  teamBPlayer2: MatchPlayerDisplay;
}

function resolveSlot(memberRow: RawSlot | null, guestRow: RawSlot | null): MatchPlayerDisplay {
  if (memberRow) {
    return { id: memberRow.id, nickname: memberRow.nickname ?? "회원", isGuest: false };
  }
  if (guestRow) {
    return { id: guestRow.id, nickname: guestRow.name ?? "게스트", isGuest: true };
  }
  return { id: "", nickname: "알수없음", isGuest: false };
}

/** Supabase 조회 결과(raw, any 타입)를 화면에서 쓰기 쉬운 DisplayMatch로 변환한다. */
export function toDisplayMatches(rows: unknown): DisplayMatch[] {
  const rawRows = (rows ?? []) as RawMatchRow[];
  return rawRows.map((row) => ({
    id: row.id,
    played_at: row.played_at,
    session_id: row.session_id,
    sessionDay: row.session?.session_day ?? null,
    sessionTitle: row.session?.title ?? null,
    score_a: row.score_a,
    score_b: row.score_b,
    score_a_tiebreak: row.score_a_tiebreak,
    score_b_tiebreak: row.score_b_tiebreak,
    winner_team: row.winner_team,
    created_at: row.created_at,
    teamAPlayer1: resolveSlot(row.team_a_player1_member_row, row.team_a_player1_guest_row),
    teamAPlayer2: resolveSlot(row.team_a_player2_member_row, row.team_a_player2_guest_row),
    teamBPlayer1: resolveSlot(row.team_b_player1_member_row, row.team_b_player1_guest_row),
    teamBPlayer2: resolveSlot(row.team_b_player2_member_row, row.team_b_player2_guest_row),
  }));
}
