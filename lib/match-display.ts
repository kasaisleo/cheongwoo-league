import type { MatchPlayerDisplay, SessionDay } from "@/lib/supabase/database.types";

/**
 * matches 조회 시 사용할 select 문자열.
 * 각 선수 슬롯은 member 또는 guest 중 하나만 채워지므로 둘 다 조회해서 화면에서 합쳐 쓴다.
 * session_id로 attendance_sessions를 조인해서 세션 구분(session_day)/제목도 함께 가져온다.
 */
export const MATCH_SELECT_WITH_PLAYERS = `
  id, played_at, session_id, score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team, created_at,
  session:attendance_sessions!matches_session_id_fkey(session_day, title),
  team_a_player1_member_row:members!matches_team_a_player1_member_fkey(id, name, nickname),
  team_a_player1_guest_row:guests!matches_team_a_player1_guest_fkey(id, name),
  team_a_player2_member_row:members!matches_team_a_player2_member_fkey(id, name, nickname),
  team_a_player2_guest_row:guests!matches_team_a_player2_guest_fkey(id, name),
  team_b_player1_member_row:members!matches_team_b_player1_member_fkey(id, name, nickname),
  team_b_player1_guest_row:guests!matches_team_b_player1_guest_fkey(id, name),
  team_b_player2_member_row:members!matches_team_b_player2_member_fkey(id, name, nickname),
  team_b_player2_guest_row:guests!matches_team_b_player2_guest_fkey(id, name)
`;

interface RawSlot {
  id: string;
  name?: string;
  nickname?: string;
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
    return { id: memberRow.id, name: memberRow.name ?? "회원", isGuest: false };
  }
  if (guestRow) {
    return { id: guestRow.id, name: guestRow.name ?? "게스트", isGuest: true };
  }
  return { id: "", name: "알수없음", isGuest: false };
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

/** Public 화면에 내려보낼 선수 표시 정보 — participant UUID를 포함하지 않는다. */
export interface PublicDisplayPlayer {
  name: string;
  isGuest: boolean;
}

/**
 * Public 화면(Client 포함) 전용 경기 타입 — DisplayMatch에서 participant UUID와
 * created_at을 제거한 최소 표시 데이터. id는 경기 자체의 식별자(edit/delete 액션용)로,
 * 참가자 UUID와는 무관하므로 유지한다.
 */
export interface PublicDisplayMatch {
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
  teamAPlayer1: PublicDisplayPlayer;
  teamAPlayer2: PublicDisplayPlayer;
  teamBPlayer1: PublicDisplayPlayer;
  teamBPlayer2: PublicDisplayPlayer;
}

function toPublicPlayer(p: MatchPlayerDisplay): PublicDisplayPlayer {
  return { name: p.name, isGuest: p.isGuest };
}

/** DisplayMatch[]에서 participant UUID/created_at을 제거해 Public 전용 타입으로 변환한다. */
export function toPublicDisplayMatches(rows: unknown): PublicDisplayMatch[] {
  return toDisplayMatches(rows).map((m) => ({
    id: m.id,
    played_at: m.played_at,
    session_id: m.session_id,
    sessionDay: m.sessionDay,
    sessionTitle: m.sessionTitle,
    score_a: m.score_a,
    score_b: m.score_b,
    score_a_tiebreak: m.score_a_tiebreak,
    score_b_tiebreak: m.score_b_tiebreak,
    winner_team: m.winner_team,
    teamAPlayer1: toPublicPlayer(m.teamAPlayer1),
    teamAPlayer2: toPublicPlayer(m.teamAPlayer2),
    teamBPlayer1: toPublicPlayer(m.teamBPlayer1),
    teamBPlayer2: toPublicPlayer(m.teamBPlayer2),
  }));
}
