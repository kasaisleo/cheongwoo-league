"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PlayerSelector, playerKey, type SelectedPlayer } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/Toast";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import type { SessionDay } from "@/lib/supabase/database.types";
import type { Member, Guest, AttendanceSession } from "@/lib/supabase/database.types";
import TennisBallLoader from "@/components/common/TennisBallLoader";

type GuestModalTarget = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";

interface SessionAttendees {
  attending: string[];
  undecided: string[];
}

// 세션별 기존 경기 수 + 출석 후 미참여 감지용
interface SessionStats {
  gameCount: number;
  attendingCount: number;
  participantIds: Set<string>;
}

// ── 완료 전 검수 경고 ─────────────────────────────────────────────
interface SubmitWarning {
  type: "no_session" | "incomplete_players" | "no_winner" | "duplicate_player";
  msg: string;
}

function getSubmitWarnings(params: {
  sessionId: string | null;
  players: (SelectedPlayer | null)[];
  winnerTeam: "A" | "B" | null;
  isTiebreakSet: boolean;
  tiebreakA: number;
  tiebreakB: number;
}): SubmitWarning[] {
  const warnings: SubmitWarning[] = [];
  if (!params.sessionId)
    warnings.push({ type: "no_session", msg: "매치를 선택해주세요." });
  if (params.players.some((p) => p === null))
    warnings.push({ type: "incomplete_players", msg: "4명의 선수를 모두 선택해주세요." });
  if (!params.winnerTeam)
    warnings.push({ type: "no_winner", msg: "승리팀을 선택해주세요." });
  if (params.isTiebreakSet && params.tiebreakA === params.tiebreakB)
    warnings.push({ type: "no_winner", msg: "타이브레이크 점수가 동점입니다." });

  // 중복 선수 검증 (null 제외 후 playerKey 기준)
  const validPlayers = params.players.filter((p): p is SelectedPlayer => p !== null);
  const keySet = new Set(validPlayers.map((p) => playerKey(p.id, p.isGuest)));
  if (keySet.size < validPlayers.length)
    warnings.push({ type: "duplicate_player", msg: "같은 선수가 중복 선택되어 있어요." });

  return warnings;
}

export default function NewMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get("sessionId");

  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [_sessionGuestIds, setSessionGuestIds] = useState<string[]>([]);  // 게스트 참석 지정용 (향후 PlayerSelector에서 우선 노출)
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<SessionAttendees>({ attending: [], undecided: [] });
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [teamAPlayer1, setTeamAPlayer1] = useState<SelectedPlayer | null>(null);
  const [teamAPlayer2, setTeamAPlayer2] = useState<SelectedPlayer | null>(null);
  const [teamBPlayer1, setTeamBPlayer1] = useState<SelectedPlayer | null>(null);
  const [teamBPlayer2, setTeamBPlayer2] = useState<SelectedPlayer | null>(null);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [tiebreakA, setTiebreakA] = useState(0);
  const [tiebreakB, setTiebreakB] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<"A" | "B" | null>(null);

  const [guestModalTarget, setGuestModalTarget] = useState<GuestModalTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 새 매치 추가
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSessionDay, setNewSessionDay] = useState<SessionDay>("saturday");
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionError, setNewSessionError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const [{ data: memberData }, { data: guestData }, sessionList] = await Promise.all([
      supabase.from("members").select("*").eq("is_active", true).eq("is_dormant", false).order("name"),
      supabase.from("guests").select("*").is("converted_to_member_id", null).eq("is_active", true).order("created_at", { ascending: false }),
      fetchActiveSessions(supabase),
    ]);
    setMembers(memberData ?? []);
    setGuests(guestData ?? []);
    setSessions(sessionList);
    if (preselectedSessionId) {
      const found = sessionList.find((s) => s.id === preselectedSessionId);
      if (found) await handleSessionSelect(found.id);
    }
    setLoading(false);
  }

  // 세션 선택: 출석 목록 + 기존 경기 수 + 지정 게스트 로드
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const supabase = createClient();
    const [{ data: attendData }, { data: matchData }] = await Promise.all([
      supabase.from("attendance").select("member_id, status").eq("session_id", sessionId).in("status", ["attending", "undecided"]),
      supabase.from("matches").select("id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member").eq("session_id", sessionId),
    ]);

    const rows = attendData ?? [];
    setAttendees({
      attending: rows.filter((r) => r.status === "attending").map((r) => r.member_id),
      undecided: rows.filter((r) => r.status === "undecided").map((r) => r.member_id),
    });

    const participantIds = new Set<string>();
    for (const m of matchData ?? []) {
      [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
        .filter(Boolean).forEach((id) => participantIds.add(id!));
    }
    const attendingCount = rows.filter((r) => r.status === "attending").length;
    setSessionStats({ gameCount: (matchData ?? []).length, attendingCount, participantIds });

    // 지정 게스트 로드 (실패해도 경기 입력 가능)
    try {
      const res = await fetch(`/api/admin/session-guests?sessionId=${sessionId}`);
      const body = await res.json().catch(() => null);
      if (res.ok) setSessionGuestIds((body.sessionGuests ?? []).map((sg: { guest_id: string }) => sg.guest_id));
    } catch { /* 무시 */ }
  }, []);  // supabase client / setter는 참조 안정 보장

  async function handleCreateSession() {
    if (!newSessionTitle.trim()) { setNewSessionError("매치명을 입력해주세요."); return; }
    if (!newSessionDate) { setNewSessionError("날짜를 선택해주세요."); return; }
    setCreatingSession(true); setNewSessionError(null);
    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSessionTitle.trim(), sessionDate: newSessionDate, sessionDay: newSessionDay }),
    });
    const body = await res.json().catch(() => null);
    setCreatingSession(false);
    if (!res.ok) { setNewSessionError(body?.error ?? "매치 추가에 실패했습니다."); return; }
    toast.success("매치가 추가되었습니다.");
    const supabase = createClient();
    const updated = await fetchActiveSessions(supabase);
    setSessions(updated);
    if (body.sessionId) await handleSessionSelect(body.sessionId);
    setShowNewSession(false);
    setNewSessionTitle("");
  }

  const isTiebreakSet = (scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7);

  useEffect(() => {
    if (scoreA === scoreB) return;
    setWinnerTeam(scoreA > scoreB ? "A" : "B");
  }, [scoreA, scoreB]);

  const selectedKeys = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2]
    .filter((p): p is SelectedPlayer => p !== null)
    .map((p) => playerKey(p.id, p.isGuest));

  function excludeKeysFor(current: SelectedPlayer | null): string[] {
    const currentKey = current ? playerKey(current.id, current.isGuest) : null;
    return selectedKeys.filter((k) => k !== currentKey);
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const selectedSessionIsCustom = selectedSession?.session_day === "holiday" || selectedSession?.session_day === "custom";
  const selectedSessionLabel = selectedSession
    ? `${MATCH_SESSION_DAY_LABEL[selectedSession.session_day]}${selectedSessionIsCustom ? ` · ${selectedSession.title}` : ""} (${selectedSession.session_date})`
    : null;

  // 저장 전 검수 경고 (소프트 — 막지 않음)
  const thisMatchPlayers = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
  const currentPlayerIds = thisMatchPlayers
    .filter((p): p is SelectedPlayer => p !== null && !p.isGuest)
    .map((p) => p.id);

  // 출석 후 미참여 감지: 출석 체크했는데 기존 + 이번 경기 모두 미등장
  const noShowWarnings: string[] = sessionStats
    ? attendees.attending.filter((mid) => {
        const inPrev = sessionStats.participantIds.has(mid);
        const inThis = currentPlayerIds.includes(mid);
        return !inPrev && !inThis;
      }).map((mid) => members.find((m) => m.id === mid)?.name ?? mid)
    : [];

  const submitWarnings = getSubmitWarnings({
    sessionId: selectedSessionId,
    players: thisMatchPlayers,
    winnerTeam,
    isTiebreakSet,
    tiebreakA,
    tiebreakB,
  });

  const isReadyToSubmit = submitWarnings.length === 0 && !submitting;

  function handleGuestCreated(guest: Guest) {
    setGuests((prev) => [guest, ...prev]);
    const selected: SelectedPlayer = { id: guest.id, name: guest.name, isGuest: true };
    if (guestModalTarget === "teamAPlayer1") setTeamAPlayer1(selected);
    if (guestModalTarget === "teamAPlayer2") setTeamAPlayer2(selected);
    if (guestModalTarget === "teamBPlayer1") setTeamBPlayer1(selected);
    if (guestModalTarget === "teamBPlayer2") setTeamBPlayer2(selected);
    setGuestModalTarget(null);
  }

  async function handleSubmit() {
    if (!isReadyToSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          playedAt: new Date().toISOString().slice(0, 10),
          teamAPlayer1: { id: teamAPlayer1!.id, isGuest: teamAPlayer1!.isGuest },
          teamAPlayer2: { id: teamAPlayer2!.id, isGuest: teamAPlayer2!.isGuest },
          teamBPlayer1: { id: teamBPlayer1!.id, isGuest: teamBPlayer1!.isGuest },
          teamBPlayer2: { id: teamBPlayer2!.id, isGuest: teamBPlayer2!.isGuest },
          scoreA, scoreB,
          scoreATiebreak: isTiebreakSet ? tiebreakA : null,
          scoreBTiebreak: isTiebreakSet ? tiebreakB : null,
          winnerTeam,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      toast.success("경기 결과가 저장되었습니다.");
      // 선수 초기화 — 세션 유지, 다음 경기 연속 입력
      setTeamAPlayer1(null); setTeamAPlayer2(null);
      setTeamBPlayer1(null); setTeamBPlayer2(null);
      setScoreA(0); setScoreB(0);
      setTiebreakA(0); setTiebreakB(0);
      setWinnerTeam(null);
      // 세션 stats 갱신 (출석 후 미참여 경고 재계산)
      if (selectedSessionId) await handleSessionSelect(selectedSessionId);
    } finally {
      setSubmitting(false);  // 성공/실패 무관하게 반드시 해제
    }
  }

  // 완료하고 나가기
  async function handleFinish() {
    if (submitting || finishing) return;  // 저장 중 중복 클릭 방지
    if (!selectedSessionId) { router.push("/admin/matches"); return; }

    // 기록 누락 경고
    const warnings: string[] = [];
    if (sessionStats) {
      if (sessionStats.gameCount === 0) warnings.push("이 매치에 경기 기록이 없어요.");

      const noShow = attendees.attending.filter((mid) => !sessionStats.participantIds.has(mid));
      if (noShow.length > 0) {
        const names = noShow.map((mid) => members.find((m) => m.id === mid)?.name ?? mid).join(", ");
        warnings.push(`출석 체크 후 경기 기록이 없는 선수: ${names}`);
      }
    }

    if (warnings.length > 0) {
      const proceed = window.confirm(
        `⚠️ 확인 필요\n\n${warnings.join("\n")}\n\n그래도 완료 처리하시겠습니까?`
      );
      if (!proceed) return;
    }

    setFinishing(true);
    try {
      router.push("/admin/matches");
    } catch {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-line-400">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="px-4 pt-6 pb-28">
      {/* ── 헤더 */}
      <header className="mb-5">
        {/* 상단 row: 뒤로가기 / 완료 */}
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={selectedSessionId
              ? `/admin/attendance?session_id=${selectedSessionId}`
              : "/admin/matches"}
            className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
            ← 출석 관리
          </Link>
          <button type="button" onClick={handleFinish} disabled={submitting || finishing}
            className="flex-shrink-0 whitespace-nowrap rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1.5 text-xs font-semibold text-clay-400 hover:bg-clay-400/20 disabled:opacity-40">
            {finishing ? "이동 중..." : "입력 완료 →"}
          </button>
        </div>
        {/* 타이틀 */}
        <p className="eyebrow-en text-clay-400">Match Result</p>
        <h1 className="headline-kr text-4xl text-line-900">경기 결과 입력</h1>
        <p className="mt-1 max-w-[240px] break-keep text-xs leading-relaxed text-line-500">연속 입력 후 완료 버튼을 눌러주세요.</p>
      </header>

      {/* ── 매치 선택 */}
      <div className="mb-6 rounded-[14px] border border-line-200/40 bg-line-50">
        <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
          <p className="text-[11px] font-semibold text-line-500">매치 *</p>
          <button type="button" onClick={() => setShowNewSession((v) => !v)}
            className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/20">
            {showNewSession ? "취소" : "+ 매치 직접 추가"}
          </button>
        </div>

        {/* 새 매치 추가 인라인 폼 */}
        {showNewSession && (
          <div className="border-b border-line-200/30 bg-line-100/40 px-4 py-4">
            <p className="mb-3 text-sm font-bold text-line-900">새 매치 추가 (소급 입력)</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-line-600">
                  매치명 <span className="text-fault-400">*</span>
                </label>
                <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="예: 6월 토요정기매치"
                  className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-line-600">날짜 <span className="text-fault-400">*</span></label>
                  <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)}
                    className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-line-600">매치 타입</label>
                  <select value={newSessionDay} onChange={(e) => setNewSessionDay(e.target.value as SessionDay)}
                    className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900">
                    <option value="saturday">토요정기매치</option>
                    <option value="sunday">일요정기매치</option>
                    <option value="holiday">휴일매치</option>
                    <option value="custom">이벤트매치</option>
                  </select>
                </div>
              </div>
              {newSessionError && <p className="text-[11px] text-fault-400">{newSessionError}</p>}
              <button type="button" disabled={creatingSession} onClick={handleCreateSession}
                className="h-10 w-full rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40">
                {creatingSession ? "추가 중..." : "매치 추가"}
              </button>
            </div>
          </div>
        )}

        {/* 세션 드롭다운 */}
        <div className="px-4 py-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-line-500">등록된 매치가 없어요. 출석 관리 화면에서 먼저 매치를 생성해주세요.</p>
          ) : (
            <Dropdown align="left"
              triggerClassName="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-100 px-3 py-2.5 text-left"
              trigger={
                <>
                  <span className="text-sm font-semibold text-line-900">
                    {selectedSessionLabel ?? "매치를 선택해주세요"}
                  </span>
                  <span className="text-xs text-line-500">▼</span>
                </>
              }>
              {(close) => (
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {sessions.map((session) => {
                    const isCustom = session.session_day === "holiday" || session.session_day === "custom";
                    return (
                      <DropdownItem key={session.id} onClick={() => { handleSessionSelect(session.id); close(); }}>
                        <span className={selectedSessionId === session.id ? "text-clay-400" : ""}>
                          {MATCH_SESSION_DAY_LABEL[session.session_day]}
                          {isCustom && ` · ${session.title}`} ({session.session_date})
                        </span>
                      </DropdownItem>
                    );
                  })}
                </div>
              )}
            </Dropdown>
          )}
        </div>

        {/* 선택된 매치 현황 */}
        {selectedSession && sessionStats !== null && (
          <div className="border-t border-line-200/30 px-4 py-2.5">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-gold">출석 {attendees.attending.length}명</span>
              <span className="text-line-500">미정 {attendees.undecided.length}명</span>
              <span className="font-score tabular-nums text-line-600">{sessionStats.gameCount}경기 기록됨</span>
              {noShowWarnings.length > 0 && (
                <span className="text-clay-400">출석 후 미참여 {noShowWarnings.length}명</span>
              )}
            </div>
            {noShowWarnings.length > 0 && (
              <p className="mt-1 text-[10px] text-clay-400">
                미참여: {noShowWarnings.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 청팀 */}
      <div className="relative mb-6 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <div className="absolute left-0 top-0 h-full w-1 bg-clay-400/50" />
        <p className="mb-3 pl-2 text-sm font-bold text-clay-400">청팀 선수</p>
        <div className="space-y-4">
          {(["teamAPlayer1", "teamAPlayer2"] as const).map((field, i) => {
            const val = field === "teamAPlayer1" ? teamAPlayer1 : teamAPlayer2;
            const setter = field === "teamAPlayer1" ? setTeamAPlayer1 : setTeamAPlayer2;
            return (
              <PlayerSelector key={field} label={`선수 ${i + 1}`}
                members={members} guests={guests}
                attendingMemberIds={attendees.attending}
                undecidedMemberIds={attendees.undecided}
                selectedKeys={selectedKeys}
                excludeKeys={excludeKeysFor(val)}
                value={val} onChange={setter}
                onRequestAddGuest={() => setGuestModalTarget(field)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 우팀 */}
      <div className="relative mb-6 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <div className="absolute left-0 top-0 h-full w-1 bg-line-300/50" />
        <p className="mb-3 pl-2 text-sm font-bold text-line-600">우팀 선수</p>
        <div className="space-y-4">
          {(["teamBPlayer1", "teamBPlayer2"] as const).map((field, i) => {
            const val = field === "teamBPlayer1" ? teamBPlayer1 : teamBPlayer2;
            const setter = field === "teamBPlayer1" ? setTeamBPlayer1 : setTeamBPlayer2;
            return (
              <PlayerSelector key={field} label={`선수 ${i + 1}`}
                members={members} guests={guests}
                attendingMemberIds={attendees.attending}
                undecidedMemberIds={attendees.undecided}
                selectedKeys={selectedKeys}
                excludeKeys={excludeKeysFor(val)}
                value={val} onChange={setter}
                onRequestAddGuest={() => setGuestModalTarget(field)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 스코어 */}
      <div className="mb-6 rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <p className="mb-3 text-center text-[11px] font-semibold text-line-500">스코어</p>
        <div className="flex items-center justify-center gap-6">
          <ScoreStepper label="청팀" value={scoreA} onChange={setScoreA} highlight={winnerTeam === "A"} max={7} />
          <span className="text-sm text-line-400">vs</span>
          <ScoreStepper label="우팀" value={scoreB} onChange={setScoreB} highlight={winnerTeam === "B"} max={7} />
        </div>

        {isTiebreakSet && (
          <div className="mt-4 border-t border-line-200/40 pt-4">
            <p className="mb-2 text-center text-[11px] font-semibold text-line-500">타이브레이크</p>
            <div className="flex items-center justify-center gap-4">
              <ScoreStepper label="청팀" value={tiebreakA} onChange={setTiebreakA} compact />
              <span className="text-xs text-line-400">:</span>
              <ScoreStepper label="우팀" value={tiebreakB} onChange={setTiebreakB} compact />
            </div>
            {tiebreakA === tiebreakB && (
              <p className="mt-2 text-center text-xs text-fault-400">타이브레이크 점수는 동점일 수 없어요.</p>
            )}
          </div>
        )}

        {/* 승리팀 선택 */}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setWinnerTeam("A")}
            className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
              winnerTeam === "A" ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200/40 text-line-600"
            }`}>청팀 승리</button>
          <button type="button" onClick={() => setWinnerTeam("B")}
            className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
              winnerTeam === "B" ? "border-gold bg-gold/15 text-gold" : "border-line-200/40 text-line-600"
            }`}>우팀 승리</button>
        </div>
      </div>

      {/* ── 저장 전 경고 */}
      {submitWarnings.length > 0 && (
        <div className="mb-3 rounded-sm border border-line-200/40 bg-line-100/50 px-3 py-2">
          {submitWarnings
            // 아무것도 입력 안 한 상태에서는 매치/선수 미선택 경고 숨김 (UX)
            .filter((w) =>
              w.type === "duplicate_player" ||
              w.type === "no_winner" ||
              (teamAPlayer1 || teamAPlayer2 || teamBPlayer1 || teamBPlayer2 || winnerTeam)
            )
            .map((w) => (
              <p key={w.type} className={`text-[11px] ${w.type === "duplicate_player" ? "font-semibold text-clay-400" : "text-line-500"}`}>
                {w.msg}
              </p>
            ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-fault-400">{error}</p>}

      <Button size="lg" className="w-full" disabled={!isReadyToSubmit} onClick={handleSubmit}>
        {submitting ? "저장 중..." : "경기 결과 저장"}
      </Button>

      {guestModalTarget && (
        <QuickGuestModal onClose={() => setGuestModalTarget(null)} onCreated={handleGuestCreated} />
      )}

      {/* ── 저장/완료 처리 중 오버레이 */}
      {submitting && (
        <TennisBallLoader
          variant="overlay"
          mode="admin"
          label="경기 기록 저장 중"
          description="기록을 저장하고 있어요."
        />
      )}
      {finishing && !submitting && (
        <TennisBallLoader
          variant="overlay"
          mode="admin"
          label="완료 처리 중"
          description="기록 상태를 확인하고 있어요."
        />
      )}
    </main>
  );
}
