import { createClient } from "@/lib/supabase/server";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches, type DisplayMatch } from "@/lib/match-display";
import { LEAGUE_POINT_WIN } from "@/lib/match-engine";
import type { AttendanceStatus, SessionDay, SessionStatus } from "@/lib/supabase/database.types";

const RECENT_MATCH_LIMIT = 5;
const RECENT_ATTENDANCE_LIMIT = 5;
const RECENT_POINT_HISTORY_LIMIT = 5;
const RECENT_PARTNER_LIMIT = 5;
/** "최근 출석률"의 표본 개수는 "최근 출석" 표시 개수와 항상 같게 맞춘다 — 둘이 다르면 화면에서 혼란스럽다. */
const ATTENDANCE_RATE_RECENT_COUNT = RECENT_ATTENDANCE_LIMIT;
/** 파트너 집계는 "최근 경기"라는 표현에 맞춰, 출석 5경기보다 더 넓은 표본(최근 30경기)에서 계산한다. */
const PARTNER_AGGREGATION_MATCH_LIMIT = 30;

export interface MemberMatchSummary {
  match: DisplayMatch;
  partner: { id: string; name: string; isGuest: boolean } | null;
  opponents: { id: string; name: string; isGuest: boolean }[];
  won: boolean;
  myScore: number;
  opponentScore: number;
  lpChange: number | null;
}

export interface MemberAttendanceSummary {
  id: string;
  sessionDate: string;
  sessionDay: SessionDay | null;
  sessionTitle: string | null;
  sessionStatus: SessionStatus | null;
  status: AttendanceStatus;
}

export interface MemberPointHistoryEntry {
  id: string;
  createdAt: string;
  pointChange: number;
  reason: string;
  matchId: string | null;
}

export interface MemberPartnerSummary {
  id: string;
  name: string;
  isGuest: boolean;
  count: number;
}

export interface AttendanceRateSummary {
  overallRate: number | null;
  recentRate: number | null;
  overallCount: number;
  recentSampleSize: number;
}

const REASON_LABEL: Record<string, string> = {
  regular_match_win: "경기 승리",
  regular_match_loss: "경기 패배 (변동 없음)",
  regular_match_rollback: "경기 수정/삭제로 취소됨",
};

export function pointHistoryReasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

export interface PointHistoryGroup {
  key: string;
  matchId: string | null;
  entries: MemberPointHistoryEntry[];
}

/**
 * 최신순으로 정렬된 LP 이력 목록에서, 같은 match_id를 가진 항목들이 인접해 있으면
 * 하나의 그룹으로 묶는다. 정렬 순서 자체는 바꾸지 않고, 화면에 보여줄 묶음 경계만
 * 계산한다. match_id가 null인 항목(예: 대회 보너스 등 경기와 무관한 변동)은 항상
 * 단독 그룹이 된다.
 */
export function groupPointHistoryByMatch(entries: MemberPointHistoryEntry[]): PointHistoryGroup[] {
  const groups: PointHistoryGroup[] = [];

  for (const entry of entries) {
    const lastGroup = groups[groups.length - 1];
    if (entry.matchId && lastGroup && lastGroup.matchId === entry.matchId) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ key: entry.id, matchId: entry.matchId, entries: [entry] });
    }
  }

  return groups;
}

/**
 * memberId가 매치의 어느 슬롯에 있는지 찾아 파트너/상대팀/점수/승패를 계산한다.
 *
 * 방어 처리: 정상적인 경기는 4개 슬롯에 회원/게스트가 한 번씩만 들어가야 한다
 * (생성/수정 API에서 이미 중복 선택을 막고 있음). 다만 그 검증이 추가되기 전에
 * 저장된 과거 데이터에 같은 회원이 두 슬롯 이상(예: 양쪽 팀에 동시) 들어있는
 * 경우가 있을 수 있다. 이런 경기는 "내 편/상대편"을 명확히 가를 수 없으므로,
 * 화면에 잘못된 정보를 보여주는 대신 null을 반환해 최근 경기 목록에서 제외한다.
 */
function summarizeMatchForMember(match: DisplayMatch, memberId: string): MemberMatchSummary | null {
  const slots = [
    { player: match.teamAPlayer1, team: "A" as const },
    { player: match.teamAPlayer2, team: "A" as const },
    { player: match.teamBPlayer1, team: "B" as const },
    { player: match.teamBPlayer2, team: "B" as const },
  ];

  const mySlots = slots.filter((s) => !s.player.isGuest && s.player.id === memberId);
  if (mySlots.length === 0) return null;
  if (mySlots.length > 1) return null; // 데이터 오류 방어: 한 회원이 여러 슬롯에 중복 등록된 경기는 제외

  const mySlot = mySlots[0];
  const partnerSlot = slots.find((s) => s.team === mySlot.team && s.player.id !== memberId);
  const opponentSlots = slots.filter((s) => s.team !== mySlot.team);

  const won = match.winner_team === mySlot.team;
  const myScore = mySlot.team === "A" ? match.score_a : match.score_b;
  const opponentScore = mySlot.team === "A" ? match.score_b : match.score_a;

  return {
    match,
    partner: partnerSlot ? partnerSlot.player : null,
    opponents: opponentSlots.map((s) => s.player),
    won,
    myScore,
    opponentScore,
    lpChange: won ? LEAGUE_POINT_WIN : 0,
  };
}

/**
 * 회원이 참가한 최근 경기 N건을 조회한다.
 * matches의 4개 선수 슬롯 컬럼을 OR로 검사하므로, members.id에 인덱스가 있는 것과
 * 별개로 매치 전체 스캔이 필요하다 — 현재 매치 수 규모(클럽 단위)에서는 문제없는
 * 수준이지만, 매치가 수만 건 단위로 늘어나면 슬롯별 인덱스를 고려할 수 있다.
 */
export async function fetchMemberRecentMatches(
  memberId: string,
  limit: number = RECENT_MATCH_LIMIT
): Promise<MemberMatchSummary[]> {
  const supabase = createClient();

  // 같은 회원이 양쪽 슬롯에 중복으로 들어간 데이터 오류 건이 필터링될 수 있으므로,
  // 요청한 개수보다 여유 있게 가져온 뒤 정확히 limit개로 자른다.
  const fetchBuffer = limit * 2;

  const { data } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .or(
      `team_a_player1_member.eq.${memberId},team_a_player2_member.eq.${memberId},team_b_player1_member.eq.${memberId},team_b_player2_member.eq.${memberId}`
    )
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(fetchBuffer);

  const matches = toDisplayMatches(data);
  return matches
    .map((match) => summarizeMatchForMember(match, memberId))
    .filter((summary): summary is MemberMatchSummary => summary !== null)
    .slice(0, limit);
}

/**
 * 회원의 최근 출석 N건. attendance_sessions를 조인해 세션명/상태를 함께 가져온다.
 *
 * 정책: status='attending'인 row만 노출한다. attendance row가 있다는 사실
 * 자체가 아니라 "실제로 참석했다"는 상태만 최근 출석으로 인정한다 — 출석을
 * 체크한 뒤 취소해서 absent/undecided로 바뀐 경우는 더 이상 노출되지 않아야
 * 한다("출석 취소 시 최근 출석에서도 제외" 정책). 반대로 attending으로
 * 남아있는 기록은 그 세션이 closed/archived가 되어도 계속 노출된다 — 이
 * 필터는 세션 상태가 아니라 attendance.status만 본다.
 */
export async function fetchMemberRecentAttendance(
  memberId: string,
  limit: number = RECENT_ATTENDANCE_LIMIT
): Promise<MemberAttendanceSummary[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("attendance")
    .select(
      `id, status, event_date,
       session:attendance_sessions!attendance_session_id_fkey(session_date, session_day, title, status)`
    )
    .eq("member_id", memberId)
    .eq("status", "attending")
    .order("event_date", { ascending: false })
    .limit(limit);

  type RawRow = {
    id: string;
    status: AttendanceStatus;
    event_date: string;
    session: { session_date: string; session_day: SessionDay; title: string; status: SessionStatus } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.id,
    sessionDate: row.session?.session_date ?? row.event_date,
    sessionDay: row.session?.session_day ?? null,
    sessionTitle: row.session?.title ?? null,
    sessionStatus: row.session?.status ?? null,
    status: row.status,
  }));
}

/**
 * 전체 출석률과 최근 N회 출석률을 계산한다. attendance 테이블 기준으로,
 * status='attending'인 비율을 사용한다(미정/불참은 출석으로 치지 않음).
 */
export async function fetchMemberAttendanceRate(memberId: string): Promise<AttendanceRateSummary> {
  const supabase = createClient();

  const { data } = await supabase
    .from("attendance")
    .select("status, event_date")
    .eq("member_id", memberId)
    .order("event_date", { ascending: false });

  const rows = data ?? [];
  const overallCount = rows.length;
  const overallAttending = rows.filter((r) => r.status === "attending").length;
  const overallRate = overallCount > 0 ? Math.round((overallAttending / overallCount) * 100) : null;

  const recentRows = rows.slice(0, ATTENDANCE_RATE_RECENT_COUNT);
  const recentSampleSize = recentRows.length;
  const recentAttending = recentRows.filter((r) => r.status === "attending").length;
  const recentRate = recentSampleSize > 0 ? Math.round((recentAttending / recentSampleSize) * 100) : null;

  return { overallRate, recentRate, overallCount, recentSampleSize };
}

/** 회원의 최근 LP 변동 내역 N건. */
export async function fetchMemberRecentPointHistory(
  memberId: string,
  limit: number = RECENT_POINT_HISTORY_LIMIT
): Promise<MemberPointHistoryEntry[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("point_history")
    .select("id, created_at, point_change, reason, match_id")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    pointChange: row.point_change,
    reason: row.reason,
    matchId: row.match_id,
  }));
}

/**
 * 최근 경기(최대 PARTNER_AGGREGATION_MATCH_LIMIT건) 안에서 가장 많이 함께 뛴
 * 파트너를 집계한다. 조 편성 참고용이라 정확한 전체 이력이 아니라 최근 표본
 * 기준으로 충분하다.
 */
export async function fetchMemberRecentPartners(
  memberId: string,
  limit: number = RECENT_PARTNER_LIMIT
): Promise<MemberPartnerSummary[]> {
  const recentMatches = await fetchMemberRecentMatches(memberId, PARTNER_AGGREGATION_MATCH_LIMIT);

  const countByPartner = new Map<string, MemberPartnerSummary>();

  for (const summary of recentMatches) {
    if (!summary.partner) continue;
    const key = `${summary.partner.isGuest ? "guest" : "member"}:${summary.partner.id}`;
    const existing = countByPartner.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countByPartner.set(key, {
        id: summary.partner.id,
        name: summary.partner.name,
        isGuest: summary.partner.isGuest,
        count: 1,
      });
    }
  }

  return Array.from(countByPartner.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
