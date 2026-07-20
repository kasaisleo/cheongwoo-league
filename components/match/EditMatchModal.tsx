"use client";

import { useEffect, useState } from "react";
import { PlayerSelector, playerKey, type SelectedPlayer, type PlayerSelectorMember, type PlayerSelectorGuest } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MATCH_SESSION_DAY_LABEL, type SessionSummary } from "@/lib/match-session-label";
import type { Guest } from "@/lib/supabase/database.types";

type GuestModalTarget = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";
type LoadError = "forbidden" | "not_found" | "server_error" | null;

interface EditMatchModalProps {
  matchId: string;
  onClose: () => void;
  onSaved: () => void;
  currentClubId: string;
}

interface EditDetailPlayer {
  id: string;
  name: string;
  isGuest: boolean;
}

interface EditDetailMatch {
  id: string;
  playedAt: string;
  scoreA: number;
  scoreB: number;
  scoreATiebreak: number | null;
  scoreBTiebreak: number | null;
  winnerTeam: "A" | "B";
  sessionId: string | null;
  teamAPlayer1: EditDetailPlayer;
  teamAPlayer2: EditDetailPlayer;
  teamBPlayer1: EditDetailPlayer;
  teamBPlayer2: EditDetailPlayer;
}

function toSelectedPlayer(p: EditDetailPlayer): SelectedPlayer {
  return { id: p.id, name: p.name, isGuest: p.isGuest };
}

const LOAD_ERROR_MESSAGE: Record<Exclude<LoadError, null>, string> = {
  forbidden: "관리자 권한이 필요합니다.",
  not_found: "경기 정보를 찾을 수 없습니다.",
  server_error: "정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
};

export function EditMatchModal({ matchId, onClose, onSaved, currentClubId }: EditMatchModalProps) {
  const [members, setMembers] = useState<PlayerSelectorMember[]>([]);
  const [guests, setGuests] = useState<PlayerSelectorGuest[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [playedAt, setPlayedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);

  const [teamAPlayer1, setTeamAPlayer1] = useState<SelectedPlayer | null>(null);
  const [teamAPlayer2, setTeamAPlayer2] = useState<SelectedPlayer | null>(null);
  const [teamBPlayer1, setTeamBPlayer1] = useState<SelectedPlayer | null>(null);
  const [teamBPlayer2, setTeamBPlayer2] = useState<SelectedPlayer | null>(null);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [tiebreakA, setTiebreakA] = useState(0);
  const [tiebreakB, setTiebreakB] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<"A" | "B">("A");

  const [guestModalTarget, setGuestModalTarget] = useState<GuestModalTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달은 조건부 렌더로만 마운트되므로, 이 effect는 "모달이 열렸을 때"에만 실행된다 —
  // 닫힌 상태에서는 edit-detail API를 호출하지 않는다.
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const detailRes = await fetch(`/api/matches/${matchId}/edit-detail`).catch(() => null);
      if (cancelled) return;

      if (!detailRes) {
        setLoadError("server_error");
        setLoading(false);
        return;
      }
      if (detailRes.status === 403) {
        setLoadError("forbidden");
        setLoading(false);
        return;
      }
      if (detailRes.status === 404) {
        setLoadError("not_found");
        setLoading(false);
        return;
      }
      if (!detailRes.ok) {
        setLoadError("server_error");
        setLoading(false);
        return;
      }

      const detailBody = await detailRes.json().catch(() => null);
      const match = detailBody?.match as EditDetailMatch | undefined;
      if (!match) {
        setLoadError("server_error");
        setLoading(false);
        return;
      }

      setSelectedSessionId(match.sessionId);
      setPlayedAt(match.playedAt);
      setTeamAPlayer1(toSelectedPlayer(match.teamAPlayer1));
      setTeamAPlayer2(toSelectedPlayer(match.teamAPlayer2));
      setTeamBPlayer1(toSelectedPlayer(match.teamBPlayer1));
      setTeamBPlayer2(toSelectedPlayer(match.teamBPlayer2));
      setScoreA(match.scoreA);
      setScoreB(match.scoreB);
      setTiebreakA(match.scoreATiebreak ?? 0);
      setTiebreakB(match.scoreBTiebreak ?? 0);
      setWinnerTeam(match.winnerTeam);

      const [memberRes, guestRes, sessionsBody] = await Promise.all([
        fetch(`/api/matches/edit-members?clubId=${currentClubId}`)
          .then((res) => res.json())
          .catch(() => {
            console.error("[EditMatchModal] edit-members 조회 실패");
            return { members: [] };
          }),
        fetch(`/api/matches/edit-guests?clubId=${currentClubId}`)
          .then((res) => res.json())
          .catch(() => {
            console.error("[EditMatchModal] edit-guests 조회 실패");
            return { guests: [] };
          }),
        fetch(`/api/attendance/public-sessions?${new URLSearchParams({ clubId: currentClubId, statuses: "open,closed", order: "asc" })}`)
          .then((res) => (res.ok ? res.json() : { sessions: [] }))
          .catch(() => {
            console.error("[EditMatchModal] public-sessions 조회 실패");
            return { sessions: [] };
          }),
      ]);
      if (cancelled) return;

      setMembers(memberRes?.members ?? []);
      setGuests(guestRes?.guests ?? []);

      let sessionList = (sessionsBody?.sessions ?? []) as SessionSummary[];
      // 이 경기에 이미 연결된 세션이 archived라서 목록에 없으면, 선택지가 사라지지 않도록 단건 모드로 추가한다.
      if (match.sessionId && !sessionList.some((s) => s.id === match.sessionId)) {
        const single = await fetch(
          `/api/attendance/public-sessions?${new URLSearchParams({ clubId: currentClubId, sessionId: match.sessionId })}`
        )
          .then((res) => (res.ok ? res.json() : { session: null }))
          .catch(() => ({ session: null }));
        if (single?.session) {
          sessionList = [single.session as SessionSummary, ...sessionList];
        }
      }
      if (cancelled) return;
      setSessions(sessionList);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [matchId, currentClubId]);

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
  const selectedSessionIsCustom =
    selectedSession?.session_day === "holiday" || selectedSession?.session_day === "custom";
  const selectedSessionLabel = selectedSession
    ? `${MATCH_SESSION_DAY_LABEL[selectedSession.session_day]}${
        selectedSessionIsCustom ? ` · ${selectedSession.title}` : ""
      } (${selectedSession.session_date})`
    : null;

  const isReadyToSubmit = Boolean(
    selectedSessionId &&
      teamAPlayer1 &&
      teamAPlayer2 &&
      teamBPlayer1 &&
      teamBPlayer2 &&
      winnerTeam &&
      (!isTiebreakSet || tiebreakA !== tiebreakB) &&
      !submitting
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

    const res = await fetch(`/api/matches/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: selectedSessionId,
        playedAt,
        teamAPlayer1: { id: teamAPlayer1!.id, isGuest: teamAPlayer1!.isGuest },
        teamAPlayer2: { id: teamAPlayer2!.id, isGuest: teamAPlayer2!.isGuest },
        teamBPlayer1: { id: teamBPlayer1!.id, isGuest: teamBPlayer1!.isGuest },
        teamBPlayer2: { id: teamBPlayer2!.id, isGuest: teamBPlayer2!.isGuest },
        scoreA,
        scoreB,
        scoreATiebreak: isTiebreakSet ? tiebreakA : null,
        scoreBTiebreak: isTiebreakSet ? tiebreakB : null,
        winnerTeam,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "경기 수정에 실패했습니다.");
      toast.error(body?.error ?? "경기 수정에 실패했습니다.");
      return;
    }

    toast.success("경기 정보가 수정되었습니다.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[var(--club-card-radius,14px)] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wide text-clay-400">경기 수정</p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-[color:var(--surface-muted)]">
            닫기
          </button>
        </div>

        {loadError ? (
          <p className="py-8 text-center text-sm text-[color:var(--surface-muted)]">
            {LOAD_ERROR_MESSAGE[loadError]}
          </p>
        ) : loading ? (
          <p className="py-8 text-center text-sm text-[color:var(--surface-muted)]">불러오는 중...</p>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-[color:var(--surface-border)] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[color:var(--surface-muted)]">세션 *</p>
              <Dropdown
                align="left"
                triggerClassName="flex w-full items-center justify-between rounded-lg border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 py-2.5 text-left"
                trigger={
                  <>
                    <span className="text-sm font-semibold text-[color:var(--control-text)]">
                      {selectedSessionLabel ?? "세션을 선택해주세요"}
                    </span>
                    <span className="text-[color:var(--control-placeholder)]">▼</span>
                  </>
                }
              >
                {(close) => (
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {sessions.map((session) => {
                      const isCustom =
                        session.session_day === "holiday" || session.session_day === "custom";
                      return (
                        <DropdownItem
                          key={session.id}
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            close();
                          }}
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
            </div>

            <div className="mb-3 rounded-lg border border-[color:var(--surface-border)] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-clay-400">청팀</p>
              <div className="space-y-2">
                <PlayerSelector
                  label="선수 1"
                  members={members}
                  guests={guests}
                  selectedKeys={selectedKeys}
                  excludeKeys={excludeKeysFor(teamAPlayer1)}
                  value={teamAPlayer1}
                  onChange={setTeamAPlayer1}
                  onRequestAddGuest={() => setGuestModalTarget("teamAPlayer1")}
                />
                <PlayerSelector
                  label="선수 2"
                  members={members}
                  guests={guests}
                  selectedKeys={selectedKeys}
                  excludeKeys={excludeKeysFor(teamAPlayer2)}
                  value={teamAPlayer2}
                  onChange={setTeamAPlayer2}
                  onRequestAddGuest={() => setGuestModalTarget("teamAPlayer2")}
                />
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-[color:var(--surface-border)] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-court-400">우팀</p>
              <div className="space-y-2">
                <PlayerSelector
                  label="선수 1"
                  members={members}
                  guests={guests}
                  selectedKeys={selectedKeys}
                  excludeKeys={excludeKeysFor(teamBPlayer1)}
                  value={teamBPlayer1}
                  onChange={setTeamBPlayer1}
                  onRequestAddGuest={() => setGuestModalTarget("teamBPlayer1")}
                />
                <PlayerSelector
                  label="선수 2"
                  members={members}
                  guests={guests}
                  selectedKeys={selectedKeys}
                  excludeKeys={excludeKeysFor(teamBPlayer2)}
                  value={teamBPlayer2}
                  onChange={setTeamBPlayer2}
                  onRequestAddGuest={() => setGuestModalTarget("teamBPlayer2")}
                />
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-[color:var(--surface-border)] p-3">
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-[color:var(--surface-muted)]">
                스코어
              </p>
              <div className="flex items-center justify-center gap-6">
                <ScoreStepper label="청팀" value={scoreA} onChange={setScoreA} highlight={winnerTeam === "A"} max={7} />
                <span className="text-[color:var(--surface-muted)]">vs</span>
                <ScoreStepper label="우팀" value={scoreB} onChange={setScoreB} highlight={winnerTeam === "B"} max={7} />
              </div>

              {isTiebreakSet && (
                <div className="mt-3 border-t border-[color:var(--surface-border)] pt-3">
                  <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                    타이브레이크
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <ScoreStepper label="청팀" value={tiebreakA} onChange={setTiebreakA} compact />
                    <span className="text-xs text-[color:var(--surface-muted)]">:</span>
                    <ScoreStepper label="우팀" value={tiebreakB} onChange={setTiebreakB} compact />
                  </div>
                  {tiebreakA === tiebreakB && (
                    <p className="mt-2 text-center text-xs text-fault-400">
                      타이브레이크 점수는 동점일 수 없어요.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWinnerTeam("A")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    winnerTeam === "A"
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-[color:var(--surface-border)] text-[color:var(--surface-muted)]"
                  }`}
                >
                  청팀 승리
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerTeam("B")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    winnerTeam === "B"
                      ? "border-court-400 bg-court-400 text-line-25"
                      : "border-[color:var(--surface-border)] text-[color:var(--surface-muted)]"
                  }`}
                >
                  우팀 승리
                </button>
              </div>
            </div>

            {error && <p className="mb-2 text-sm text-fault-400">{error}</p>}

            <Button size="lg" className="w-full" disabled={!isReadyToSubmit} onClick={handleSubmit}>
              {submitting ? "저장 중..." : "수정 내용 저장"}
            </Button>
          </>
        )}
      </div>

      {guestModalTarget && (
        <QuickGuestModal onClose={() => setGuestModalTarget(null)} onCreated={handleGuestCreated} />
      )}
    </div>
  );
}
