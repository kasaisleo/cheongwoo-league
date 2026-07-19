import { requireAdminAccess } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { judgeMatchStatus } from "@/lib/records/matchStatus";
import MatchRecordsPageClient, {
  type SessionSummary,
  type PlayerStatusRow,
} from "./MatchRecordsPageClient";
import type { AttendanceStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/**
 * 경기 검수 데이터 — service-role + access.clubId로 서버에서 전부 집계한다.
 * attendance_sessions(club_id 보유)로 club 범위 session_id 집합을 얻은 뒤
 * attendance(club_id 없음)는 그 집합으로만 scope한다.
 * 펼침 UI(선수별 상태)도 세션별로 전량 미리 계산해 Client 재조회를 없앤다.
 *
 * requireAdminAccess() 사용 — 인증 실패 시 attendance 집계 쿼리 실행 전에
 * redirect로 차단한다(빌드 타임 프리렌더 시도에서도 동일하게 안전).
 */
export default async function AdminRecordsMatchesPage() {
  const access = await requireAdminAccess();
  const currentClubId = access.clubId ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const admin = createServiceClient();

  const { data: sessions } = await admin
    .from("attendance_sessions")
    .select("id, title, session_date, session_day, status")
    .eq("club_id", currentClubId)
    .neq("status", "archived")
    .order("session_date", { ascending: false });
  const sessionList = sessions ?? [];
  const clubSessionIds = sessionList.map((s) => s.id);

  const [{ data: allMatches }, { data: allAttendance }, { data: members }] = await Promise.all([
    admin
      .from("matches")
      .select("id, session_id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member")
      .eq("club_id", currentClubId),
    clubSessionIds.length > 0
      ? admin.from("attendance").select("session_id, member_id, status").in("session_id", clubSessionIds)
      : Promise.resolve({ data: [] as { session_id: string | null; member_id: string; status: string }[] }),
    admin.from("members").select("id, name").eq("club_id", currentClubId).eq("is_active", true).order("nickname"),
  ]);

  const memberList = members ?? [];
  const totalMembers = memberList.length;

  const attendBySession = new Map<string, { member_id: string; status: AttendanceStatus }[]>();
  for (const row of allAttendance ?? []) {
    if (!row.session_id) continue;
    if (!attendBySession.has(row.session_id)) attendBySession.set(row.session_id, []);
    attendBySession.get(row.session_id)!.push({ member_id: row.member_id, status: row.status as AttendanceStatus });
  }

  const participantsBySession = new Map<string, Set<string>>();
  const gameCountBySession = new Map<string, number>();
  for (const m of allMatches ?? []) {
    if (!m.session_id) continue;
    if (!participantsBySession.has(m.session_id)) participantsBySession.set(m.session_id, new Set());
    const s = participantsBySession.get(m.session_id)!;
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
      .filter(Boolean)
      .forEach((id) => s.add(id!));
    gameCountBySession.set(m.session_id, (gameCountBySession.get(m.session_id) ?? 0) + 1);
  }

  const summaries: SessionSummary[] = sessionList.map((session) => {
    const isCompleted = session.status === "closed" || session.session_date < today;
    const attendRows = attendBySession.get(session.id) ?? [];
    const attendingCount = attendRows.filter((r) => r.status === "attending").length;
    const absentCount = attendRows.filter((r) => r.status === "absent").length;
    const undecidedCount = attendRows.filter((r) => r.status === "undecided").length;
    const respondedCount = attendingCount + absentCount + undecidedCount;
    const noResponseCount = isCompleted ? Math.max(0, totalMembers - respondedCount) : 0;

    const participants = participantsBySession.get(session.id) ?? new Set<string>();
    const gameCount = gameCountBySession.get(session.id) ?? 0;

    const noShowMembers = attendRows
      .filter((r) => r.status === "attending" && !participants.has(r.member_id))
      .map((r) => r.member_id);

    return {
      session: { id: session.id, title: session.title, session_date: session.session_date, session_day: session.session_day, status: session.status },
      isCompleted,
      gameCount,
      attendingCount,
      absentCount,
      undecidedCount,
      noResponseCount,
      gameParticipantCount: participants.size,
      noShowCount: noShowMembers.length,
      noShowMembers,
      matchStatus: judgeMatchStatus({ isCompleted, gameCount, attendingCount, gameParticipantCount: participants.size, noShowCount: noShowMembers.length }),
    };
  });

  const playerRowsBySession: Record<string, PlayerStatusRow[]> = {};
  const ORDER: Record<PlayerStatusRow["status"], number> = { "경기 참여": 0, "출석 후 미참여": 1, "미참여": 2, "미출석": 3 };
  for (const session of sessionList) {
    const isCompleted = session.status === "closed" || session.session_date < today;
    const respondedMap = new Map((attendBySession.get(session.id) ?? []).map((r) => [r.member_id, r.status]));
    const participants = participantsBySession.get(session.id) ?? new Set<string>();

    const rows: PlayerStatusRow[] = memberList.map((m) => {
      const attendStatus = respondedMap.get(m.id);
      const inGame = participants.has(m.id);
      let status: PlayerStatusRow["status"];
      if (inGame) status = "경기 참여";
      else if (attendStatus === "attending") status = "출석 후 미참여";
      else if (attendStatus === "absent" || attendStatus === "undecided") status = "미참여";
      else status = isCompleted ? "미출석" : "미참여";
      return { memberId: m.id, name: m.name, status };
    });

    rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, "ko"));
    playerRowsBySession[session.id] = rows;
  }

  return (
    <MatchRecordsPageClient
      summaries={summaries}
      totalMembersCount={totalMembers}
      playerRowsBySession={playerRowsBySession}
    />
  );
}
