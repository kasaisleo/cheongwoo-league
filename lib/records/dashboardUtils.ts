import { judgeMatchStatus } from "./matchStatus";

// ── 기본 유틸 ────────────────────────────────────────────────────
export function pct(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num / den) * 100);
}
export function fmtPct(val: number | null): string {
  return val === null ? "-" : `${val}%`;
}

// ── 입력 타입 ────────────────────────────────────────────────────
export interface SessionInput {
  id: string;
  title: string;
  session_date: string;
  session_day: string;
  status: string;
}

export interface MatchInput {
  id: string;
  session_id: string | null;
  team_a_player1_member: string | null;
  team_a_player2_member: string | null;
  team_b_player1_member: string | null;
  team_b_player2_member: string | null;
  winner_team: string;
}

export interface AttendanceInput {
  session_id: string | null;
  member_id: string;
  status: string;
}

// ── KPI 요약 ─────────────────────────────────────────────────────
export interface RecordsDashboardSummary {
  completedCount: number;
  totalGames: number;
  avgParticipationRate: number | null;  // 평균 경기 참여율
  avgAttendRate: number | null;         // 평균 출석 체크율
  needsCheckCount: number;              // 확인 필요 경기 수
  missingRecordCount: number;           // 기록 부족 경기 수
  totalNoShow: number;                  // 출석 후 미참여 총 인원 건수
}

export function buildRecordsDashboardSummary(
  sessions: SessionInput[],
  matches: MatchInput[],
  attendance: AttendanceInput[],
  today: string,
  totalMemberCount: number,
): RecordsDashboardSummary {
  const completedIds = new Set(
    sessions.filter((s) => s.status === "closed" || s.session_date < today).map((s) => s.id)
  );
  const completedCount = completedIds.size;

  // session별 집계
  const gameCountBySid = new Map<string, number>();
  const participantsBySid = new Map<string, Set<string>>();
  for (const m of matches) {
    if (!m.session_id) continue;
    gameCountBySid.set(m.session_id, (gameCountBySid.get(m.session_id) ?? 0) + 1);
    if (!participantsBySid.has(m.session_id)) participantsBySid.set(m.session_id, new Set());
    const s = participantsBySid.get(m.session_id)!;
    [m.team_a_player1_member, m.team_a_player2_member,
     m.team_b_player1_member, m.team_b_player2_member].filter(Boolean).forEach((id) => s.add(id!));
  }

  const attendBySid = new Map<string, { member_id: string; status: string }[]>();
  for (const a of attendance) {
    if (!a.session_id) continue;
    if (!attendBySid.has(a.session_id)) attendBySid.set(a.session_id, []);
    attendBySid.get(a.session_id)!.push({ member_id: a.member_id, status: a.status });
  }

  let totalGames = 0;
  let sumParticipationRate = 0;
  let sumAttendRate = 0;
  let validParticipation = 0;
  let validAttend = 0;
  let needsCheckCount = 0;
  let missingRecordCount = 0;
  let totalNoShow = 0;

  for (const sid of completedIds) {
    const gameCount = gameCountBySid.get(sid) ?? 0;
    totalGames += gameCount;

    const participants = participantsBySid.get(sid) ?? new Set<string>();
    const rows = attendBySid.get(sid) ?? [];
    const attendingCount = rows.filter((r) => r.status === "attending").length;

    // 출석 후 미참여
    const noShow = rows.filter((r) => r.status === "attending" && !participants.has(r.member_id)).length;
    totalNoShow += noShow;

    // 상태 판단
    const status = judgeMatchStatus({ isCompleted: true, gameCount, attendingCount, gameParticipantCount: participants.size, noShowCount: noShow });
    if (status === "확인 필요") needsCheckCount++;
    if (status === "기록 부족") missingRecordCount++;

    // 평균 참여율
    const partRate = pct(participants.size, totalMemberCount);
    if (partRate !== null) { sumParticipationRate += partRate; validParticipation++; }

    // 평균 출석 체크율
    const responded = rows.length;
    const attendRate = pct(attendingCount, responded + Math.max(0, totalMemberCount - responded));
    if (attendRate !== null) { sumAttendRate += attendRate; validAttend++; }
  }

  return {
    completedCount,
    totalGames,
    avgParticipationRate: validParticipation > 0 ? Math.round(sumParticipationRate / validParticipation) : null,
    avgAttendRate: validAttend > 0 ? Math.round(sumAttendRate / validAttend) : null,
    needsCheckCount,
    missingRecordCount,
    totalNoShow,
  };
}

// ── Management Alerts ─────────────────────────────────────────────
export interface AlertSession {
  id: string;
  title: string;
  session_date: string;
  session_day: string;
  reason: string;  // "확인 필요" | "기록 부족" | "출석 후 미참여 N명"
}

export interface AlertPlayer {
  id: string;
  name: string;
  isGuest: boolean;
  absenceRate: number;     // 미참여도 %
  gameSessionCount: number;
  totalCompleted: number;
}

export interface ManagementAlerts {
  sessionAlerts: AlertSession[];   // 최대 10개
  playerAlerts: AlertPlayer[];     // 미참여도 높은 회원 최대 5명
}

export function buildManagementAlerts(
  sessions: SessionInput[],
  matches: MatchInput[],
  attendance: AttendanceInput[],
  members: { id: string; name: string }[],
  today: string,
): ManagementAlerts {
  const completedSessions = sessions.filter((s) => s.status === "closed" || s.session_date < today);
  const completedIds = new Set(completedSessions.map((s) => s.id));

  const gameCountBySid = new Map<string, number>();
  const participantsBySid = new Map<string, Set<string>>();
  for (const m of matches) {
    if (!m.session_id) continue;
    gameCountBySid.set(m.session_id, (gameCountBySid.get(m.session_id) ?? 0) + 1);
    if (!participantsBySid.has(m.session_id)) participantsBySid.set(m.session_id, new Set());
    [m.team_a_player1_member, m.team_a_player2_member,
     m.team_b_player1_member, m.team_b_player2_member].filter(Boolean).forEach((id) =>
      participantsBySid.get(m.session_id!)!.add(id!));
  }

  const attendBySid = new Map<string, { member_id: string; status: string }[]>();
  for (const a of attendance) {
    if (!a.session_id || !completedIds.has(a.session_id)) continue;
    if (!attendBySid.has(a.session_id)) attendBySid.set(a.session_id, []);
    attendBySid.get(a.session_id)!.push({ member_id: a.member_id, status: a.status });
  }

  // session alerts
  const sessionAlerts: AlertSession[] = [];
  for (const s of completedSessions) {
    const gameCount = gameCountBySid.get(s.id) ?? 0;
    const participants = participantsBySid.get(s.id) ?? new Set<string>();
    const rows = attendBySid.get(s.id) ?? [];
    const attendingCount = rows.filter((r) => r.status === "attending").length;
    const noShow = rows.filter((r) => r.status === "attending" && !participants.has(r.member_id)).length;

    const status = judgeMatchStatus({ isCompleted: true, gameCount, attendingCount, gameParticipantCount: participants.size, noShowCount: noShow });
    let reason = "";
    if (status === "기록 부족") reason = "기록 부족";
    else if (noShow > 0) reason = `출석 후 미참여 ${noShow}명`;
    else if (status === "확인 필요") reason = "확인 필요";

    if (reason) sessionAlerts.push({ id: s.id, title: s.title, session_date: s.session_date, session_day: s.session_day, reason });
    if (sessionAlerts.length >= 10) break;
  }

  // player alerts — 미참여도 높은 회원
  const memberGameSessions = new Map<string, Set<string>>();
  for (const [sid, pts] of participantsBySid) {
    if (!completedIds.has(sid)) continue;
    for (const mid of pts) {
      if (!memberGameSessions.has(mid)) memberGameSessions.set(mid, new Set());
      memberGameSessions.get(mid)!.add(sid);
    }
  }
  const totalCompleted = completedIds.size;

  const playerAlerts: AlertPlayer[] = members
    .map((m) => {
      const gameSessions = memberGameSessions.get(m.id)?.size ?? 0;
      const absenceRate = pct(totalCompleted - gameSessions, totalCompleted) ?? 0;
      return { id: m.id, name: m.name, isGuest: false, absenceRate, gameSessionCount: gameSessions, totalCompleted };
    })
    .filter((p) => p.absenceRate >= 50 && totalCompleted >= 3)  // 의미 있는 기준
    .sort((a, b) => b.absenceRate - a.absenceRate || a.gameSessionCount - b.gameSessionCount || a.name.localeCompare(b.name, "ko"))
    .slice(0, 5);

  return { sessionAlerts, playerAlerts };
}
