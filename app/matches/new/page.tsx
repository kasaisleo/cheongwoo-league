"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type GuestModalTarget = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";

/** 세션 attendee 목록 */
interface SessionAttendees {
  attending: string[];  // member_id[]
  undecided: string[];
}

export default function NewMatchPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<SessionAttendees>({ attending: [], undecided: [] });
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

  // 새 매치 추가 state
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSessionDay, setNewSessionDay] = useState<SessionDay>("saturday");
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionError, setNewSessionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(false);
  }

  /** 새 매치(출석 세션) 생성 후 자동 선택 */
  async function handleCreateSession() {
    if (!newSessionTitle.trim()) { setNewSessionError("매치명을 입력해주세요."); return; }
    if (!newSessionDate) { setNewSessionError("날짜를 선택해주세요."); return; }
    setCreatingSession(true); setNewSessionError(null);

    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newSessionTitle.trim(),
        sessionDate: newSessionDate,
        sessionDay: newSessionDay,
      }),
    });
    const body = await res.json().catch(() => null);
    setCreatingSession(false);

    if (!res.ok) {
      setNewSessionError(body?.error ?? "매치 추가에 실패했습니다.");
      return;
    }

    toast.success("매치가 추가되었습니다.");
    // 세션 목록 갱신 후 자동 선택
    const supabase = createClient();
    const updated = await fetchActiveSessions(supabase);
    setSessions(updated);
    if (body.sessionId) {
      await handleSessionSelect(body.sessionId);
    }
    setShowNewSession(false);
    setNewSessionTitle("");
  }

  /** 세션 선택 시 attendee 목록 로딩 */
  async function handleSessionSelect(sessionId: string) {
    setSelectedSessionId(sessionId);
    const supabase = createClient();
    const { data } = await supabase
      .from("attendance")
      .select("member_id, status")
      .eq("session_id", sessionId)
      .in("status", ["attending", "undecided"]);

    const rows = data ?? [];
    setAttendees({
      attending: rows.filter((r) => r.status === "attending").map((r) => r.member_id),
      undecided: rows.filter((r) => r.status === "undecided").map((r) => r.member_id),
    });
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

  const isReadyToSubmit = Boolean(
    selectedSessionId && teamAPlayer1 && teamAPlayer2 && teamBPlayer1 && teamBPlayer2 &&
    winnerTeam && (!isTiebreakSet || tiebreakA !== tiebreakB) && !submitting
  );

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
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "저장에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    router.push("/ranking");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-line-400">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">Match Result</p>
        <h1 className="headline-kr text-4xl text-line-900">경기 결과 입력</h1>
        <p className="mt-1 text-sm text-line-500">생성된 매치를 선택하고 경기 결과를 입력합니다.</p>
      </header>

      {/* ── 출석 기준 매치 선택 ─────────────────────────── */}
      <div className="mb-8 rounded-[14px] border border-line-200/40 bg-line-50">
        <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
          <p className="text-[11px] font-semibold text-line-500">매치 *</p>
          <button
            type="button"
            onClick={() => setShowNewSession((v) => !v)}
            className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/20"
          >
            {showNewSession ? "취소" : "+ 새 매치 추가"}
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
                <input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="예: 6월 토요정기매치"
                  className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-line-600">
                    날짜 <span className="text-fault-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-line-600">매치 타입</label>
                  <select
                    value={newSessionDay}
                    onChange={(e) => setNewSessionDay(e.target.value as any)}
                    className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900"
                  >
                    <option value="saturday">토요정기매치</option>
                    <option value="sunday">일요정기매치</option>
                    <option value="holiday">휴일매치</option>
                    <option value="custom">이벤트매치</option>
                  </select>
                </div>
              </div>
              {newSessionError && <p className="text-[11px] text-fault-400">{newSessionError}</p>}
              <button
                type="button"
                disabled={creatingSession}
                onClick={handleCreateSession}
                className="h-10 w-full rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
              >
                {creatingSession ? "추가 중..." : "매치 추가"}
              </button>
            </div>
          </div>
        )}

        {/* 드롭다운 */}
        <div className="px-4 py-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-line-500">
              등록된 매치가 없어요. 출석 관리 화면에서 먼저 매치를 생성해주세요.
            </p>
          ) : (
            <Dropdown
              align="left"
              triggerClassName="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-100 px-3 py-2.5 text-left"
              trigger={
                <>
                  <span className="text-sm font-semibold text-line-900">
                    {selectedSessionLabel ?? "매치를 선택해주세요"}
                  </span>
                  <span className="text-line-500 text-xs">▼</span>
                </>
              }
            >
              {(close) => (
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {sessions.map((session) => {
                    const isCustom = session.session_day === "holiday" || session.session_day === "custom";
                    return (
                      <DropdownItem
                        key={session.id}
                        onClick={() => { handleSessionSelect(session.id); close(); }}
                      >
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
      </div>

      {/* ── 청팀 ─────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <div className="absolute left-0 top-0 h-full w-1 bg-clay-400/50" />
        <p className="mb-3 pl-2 text-sm font-bold text-clay-400">청팀 선수</p>
        <div className="space-y-4">
          {(["teamAPlayer1", "teamAPlayer2"] as const).map((field, i) => {
            const val = field === "teamAPlayer1" ? teamAPlayer1 : teamAPlayer2;
            const setter = field === "teamAPlayer1" ? setTeamAPlayer1 : setTeamAPlayer2;
            return (
              <PlayerSelector
                key={field}
                label={`선수 ${i + 1}`}
                members={members}
                guests={guests}
                attendingMemberIds={attendees.attending}
                undecidedMemberIds={attendees.undecided}
                selectedKeys={selectedKeys}
                excludeKeys={excludeKeysFor(val)}
                value={val}
                onChange={setter}
                onRequestAddGuest={() => setGuestModalTarget(field)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 우팀 ─────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <div className="absolute left-0 top-0 h-full w-1 bg-line-300/50" />
        <p className="mb-3 pl-2 text-sm font-bold text-line-600">우팀 선수</p>
        <div className="space-y-4">
          {(["teamBPlayer1", "teamBPlayer2"] as const).map((field, i) => {
            const val = field === "teamBPlayer1" ? teamBPlayer1 : teamBPlayer2;
            const setter = field === "teamBPlayer1" ? setTeamBPlayer1 : setTeamBPlayer2;
            return (
              <PlayerSelector
                key={field}
                label={`선수 ${i + 1}`}
                members={members}
                guests={guests}
                attendingMemberIds={attendees.attending}
                undecidedMemberIds={attendees.undecided}
                selectedKeys={selectedKeys}
                excludeKeys={excludeKeysFor(val)}
                value={val}
                onChange={setter}
                onRequestAddGuest={() => setGuestModalTarget(field)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 스코어 ────────────────────────────────────────── */}
      <div className="mb-8 rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <p className="mb-3 text-center text-[11px] font-semibold text-line-500">스코어</p>
        <div className="flex items-center justify-center gap-6">
          <ScoreStepper label="청팀" value={scoreA} onChange={setScoreA} highlight={winnerTeam === "A"} max={7} />
          <span className="text-line-400 text-sm">vs</span>
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
              <p className="mt-2 text-center text-xs text-fault-400">
                타이브레이크 점수는 동점일 수 없어요.
              </p>
            )}
          </div>
        )}

        {/* 승리팀 선택 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setWinnerTeam("A")}
            className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
              winnerTeam === "A"
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200/40 text-line-600"
            }`}
          >
            청팀 승리
          </button>
          <button
            type="button"
            onClick={() => setWinnerTeam("B")}
            className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
              winnerTeam === "B"
                ? "border-gold bg-gold/15 text-gold"
                : "border-line-200/40 text-line-600"
            }`}
          >
            우팀 승리
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-fault-400">{error}</p>}

      <Button size="lg" className="w-full" disabled={!isReadyToSubmit} onClick={handleSubmit}>
        {submitting ? "저장 중..." : "경기 결과 저장"}
      </Button>

      {guestModalTarget && (
        <QuickGuestModal onClose={() => setGuestModalTarget(null)} onCreated={handleGuestCreated} />
      )}
    </main>
  );
}
