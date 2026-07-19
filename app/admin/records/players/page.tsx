import { requireAdminAccess } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import PlayerRecordsPageClient, { type PlayerRecord } from "./PlayerRecordsPageClient";
import type { MemberType } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/**
 * 선수 기록 분석 데이터 — service-role + access.clubId로 서버에서 전부 집계한다.
 * attendance_sessions(club_id 보유)로 club 범위 session_id 집합을 얻은 뒤
 * attendance(club_id 없음)는 그 집합으로만 scope한다.
 *
 * requireAdminAccess() 사용 — 인증 실패 시 attendance 집계 쿼리 실행 전에
 * redirect로 차단한다(빌드 타임 프리렌더 시도에서도 동일하게 안전).
 */
export default async function AdminRecordsPlayersPage() {
  const access = await requireAdminAccess();
  const currentClubId = access.clubId ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const admin = createServiceClient();

  const { data: sessions } = await admin
    .from("attendance_sessions")
    .select("id, session_date, status")
    .eq("club_id", currentClubId)
    .neq("status", "archived");
  const sessionList = sessions ?? [];
  const clubSessionIds = sessionList.map((s) => s.id);

  const [{ data: matches }, { data: attendanceRows }, { data: members }, { data: guests }] = await Promise.all([
    admin
      .from("matches")
      .select("winner_team, session_id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member, team_a_player1_guest, team_a_player2_guest, team_b_player1_guest, team_b_player2_guest")
      .eq("club_id", currentClubId),
    clubSessionIds.length > 0
      ? admin.from("attendance").select("session_id, member_id, status").in("session_id", clubSessionIds)
      : Promise.resolve({ data: [] as { session_id: string | null; member_id: string; status: string }[] }),
    admin.from("members").select("id, name, member_type, league_point").eq("club_id", currentClubId).eq("is_active", true),
    admin
      .from("guests")
      .select("id, name")
      .eq("club_id", currentClubId)
      .eq("is_active", true)
      .is("converted_to_member_id", null)
      .order("name", { ascending: true }),
  ]);

  const memberList: { id: string; name: string; member_type: MemberType; league_point: number }[] = members ?? [];
  const guestList: { id: string; name: string }[] = guests ?? [];

  const completedIds = new Set(
    sessionList.filter((s) => s.status === "closed" || s.session_date < today).map((s) => s.id)
  );
  const totalCompleted = completedIds.size;

  const participantsPerSession = new Map<string, Set<string>>();
  for (const m of matches ?? []) {
    if (!m.session_id) continue;
    if (!participantsPerSession.has(m.session_id)) participantsPerSession.set(m.session_id, new Set());
    const s = participantsPerSession.get(m.session_id)!;
    [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member].filter(Boolean).forEach((id) => s.add("M:" + id));
    [m.team_a_player1_guest, m.team_a_player2_guest, m.team_b_player1_guest, m.team_b_player2_guest].filter(Boolean).forEach((id) => s.add("G:" + id));
  }

  const gameSessionsPerPlayer = new Map<string, Set<string>>();
  for (const [sid, participants] of participantsPerSession) {
    if (!completedIds.has(sid)) continue;
    for (const key of participants) {
      if (!gameSessionsPerPlayer.has(key)) gameSessionsPerPlayer.set(key, new Set());
      gameSessionsPerPlayer.get(key)!.add(sid);
    }
  }

  const statMap = new Map<string, PlayerRecord>();
  const mk = (id: string, isGuest: boolean): PlayerRecord => isGuest
    ? { id, name: guestList.find((g) => g.id === id)?.name ?? "게스트", isGuest: true, memberType: null, games: 0, wins: 0, losses: 0, winRate: 0, lp: null, attending: 0, noShowCount: 0, totalCompleted: 0, attendRate: 0, noShowRate: 0, gameSessionCount: 0, participationRate: 0, absenceRate: 0 }
    : { id, name: memberList.find((m) => m.id === id)?.name ?? "알수없음", isGuest: false, memberType: memberList.find((m) => m.id === id)?.member_type ?? null, games: 0, wins: 0, losses: 0, winRate: 0, lp: memberList.find((m) => m.id === id)?.league_point ?? null, attending: 0, noShowCount: 0, totalCompleted, attendRate: 0, noShowRate: 0, gameSessionCount: 0, participationRate: 0, absenceRate: 0 };

  function ensure(id: string, isGuest: boolean) {
    const key = (isGuest ? "G:" : "M:") + id;
    if (!statMap.has(key)) statMap.set(key, mk(id, isGuest));
    return statMap.get(key)!;
  }

  for (const m of matches ?? []) {
    const aWin = m.winner_team === "A";
    const slots: [string | null, boolean, boolean][] = [
      [m.team_a_player1_member, false, aWin], [m.team_a_player2_member, false, aWin],
      [m.team_b_player1_member, false, !aWin], [m.team_b_player2_member, false, !aWin],
      [m.team_a_player1_guest, true, aWin], [m.team_a_player2_guest, true, aWin],
      [m.team_b_player1_guest, true, !aWin], [m.team_b_player2_guest, true, !aWin],
    ];
    for (const [id, isGuest, isWin] of slots) {
      if (!id) continue;
      const p = ensure(id, isGuest);
      p.games++; if (isWin) p.wins++; else p.losses++;
    }
  }

  for (const row of attendanceRows ?? []) {
    if (!row.session_id || !completedIds.has(row.session_id)) continue;
    const rec = ensure(row.member_id, false);
    if (row.status === "attending") {
      rec.attending++;
      const inGame = participantsPerSession.get(row.session_id)?.has("M:" + row.member_id);
      if (!inGame) rec.noShowCount++;
    }
  }

  for (const [key, p] of statMap) {
    p.winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
    p.attendRate = p.totalCompleted > 0 ? Math.round((p.attending / p.totalCompleted) * 100) : 0;
    p.noShowRate = p.attending > 0 ? Math.round((p.noShowCount / p.attending) * 100) : 0;
    const gameSessions = gameSessionsPerPlayer.get(key)?.size ?? 0;
    p.gameSessionCount = gameSessions;
    p.participationRate = p.totalCompleted > 0 ? Math.round((gameSessions / p.totalCompleted) * 100) : 0;
    p.absenceRate = p.totalCompleted > 0 ? 100 - p.participationRate : 0;
  }

  return <PlayerRecordsPageClient players={[...statMap.values()]} />;
}
