import { requireAdminAccess } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { judgeAttendanceStatus } from "@/lib/records/attendanceStatus";
import AttendanceRecordsPageClient, {
  type SessionAttendSummary,
  type MemberRow,
} from "./AttendanceRecordsPageClient";

export const dynamic = "force-dynamic";

function pct(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num / den) * 100);
}

/**
 * 출석 체크 검수 데이터 — service-role + access.clubId로 서버에서 전부 집계한다.
 * attendance_sessions(club_id 보유)를 먼저 club 범위로 조회해 session_id 집합을
 * 얻은 뒤, attendance(club_id 없음)는 그 집합으로만 scope한다.
 * 펼침 UI용 회원별 상세도 여기서 세션별로 미리 계산해 Client가 재조회하지
 * 않도록 한다(세션·회원 규모가 작아 전량 계산 비용이 무시 가능).
 *
 * requireAdminAccess() 사용 — getAdminAccessServer()만 쓰면 비관리자도 이
 * 서버 컴포넌트의 attendance 집계 로직 자체는 통과해버린다(이후 Client에서만
 * 걸러졌음). redirect 기반 가드로 인증 실패 시 쿼리 실행 전에 확실히 차단한다.
 */
export default async function AdminRecordsAttendancePage() {
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

  const [{ data: allAttendance }, { data: allMatches }, { data: members }] = await Promise.all([
    clubSessionIds.length > 0
      ? admin.from("attendance").select("member_id, session_id, status").in("session_id", clubSessionIds)
      : Promise.resolve({ data: [] as { member_id: string; session_id: string | null; status: string }[] }),
    admin
      .from("matches")
      .select("session_id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member")
      .eq("club_id", currentClubId),
    admin.from("members").select("id, name").eq("club_id", currentClubId).eq("is_active", true).order("nickname"),
  ]);

  const memberList = members ?? [];
  const memberCount = memberList.length;

  const attendBySid = new Map<string, Map<string, string>>();
  for (const row of allAttendance ?? []) {
    if (!row.session_id) continue;
    if (!attendBySid.has(row.session_id)) attendBySid.set(row.session_id, new Map());
    attendBySid.get(row.session_id)!.set(row.member_id, row.status);
  }

  const participantsBySid = new Map<string, Set<string>>();
  for (const m of allMatches ?? []) {
    if (!m.session_id) continue;
    if (!participantsBySid.has(m.session_id)) participantsBySid.set(m.session_id, new Set());
    const s = participantsBySid.get(m.session_id)!;
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
      .filter(Boolean)
      .forEach((id) => s.add(id!));
  }

  const summaries: SessionAttendSummary[] = sessionList.map((session) => {
    const isCompleted = session.status === "closed" || session.session_date < today;
    const statusMap = attendBySid.get(session.id) ?? new Map<string, string>();

    let attendingCount = 0, undecidedCount = 0, absentCount = 0;
    for (const st of statusMap.values()) {
      if (st === "attending") attendingCount++;
      else if (st === "undecided") undecidedCount++;
      else if (st === "absent") absentCount++;
    }
    const respondedCount = attendingCount + undecidedCount + absentCount;
    const noResponseCount = Math.max(0, memberCount - respondedCount);

    const participants = participantsBySid.get(session.id) ?? new Set<string>();
    let noShowCount = 0;
    for (const [mid, st] of statusMap) {
      if (st === "attending" && !participants.has(mid)) noShowCount++;
    }

    const checkRate = pct(respondedCount, memberCount);
    const checkStatus = judgeAttendanceStatus({
      isCompleted,
      totalMembers: memberCount,
      attendingCount,
      undecidedCount,
      absentCount,
      noResponseCount,
      noShowCount,
    });

    return {
      id: session.id,
      title: session.title,
      session_date: session.session_date,
      session_day: session.session_day,
      isCompleted,
      attendingCount,
      undecidedCount,
      absentCount,
      noResponseCount,
      noShowCount,
      respondedCount,
      checkRate,
      checkStatus,
    };
  });

  const memberRowsBySession: Record<string, MemberRow[]> = {};
  const ORDER: Record<MemberRow["status"], number> = {
    "출석 후 미참여": 0,
    "출석": 1,
    "미정": 2,
    "불참": 3,
    "미응답": 4,
  };
  for (const session of sessionList) {
    const statusMap = attendBySid.get(session.id) ?? new Map<string, string>();
    const participants = participantsBySid.get(session.id) ?? new Set<string>();

    const rows: MemberRow[] = memberList.map((m) => {
      const st = statusMap.get(m.id);
      let status: MemberRow["status"];
      if (st === "attending") status = participants.has(m.id) ? "출석" : "출석 후 미참여";
      else if (st === "undecided") status = "미정";
      else if (st === "absent") status = "불참";
      else status = "미응답";
      return { memberId: m.id, name: m.name, status };
    });

    rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, "ko"));
    memberRowsBySession[session.id] = rows;
  }

  return (
    <AttendanceRecordsPageClient
      summaries={summaries}
      totalMembers={memberCount}
      memberRowsBySession={memberRowsBySession}
    />
  );
}
