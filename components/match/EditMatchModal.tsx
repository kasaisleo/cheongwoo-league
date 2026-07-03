"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayerSelector, playerKey, type SelectedPlayer } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { DisplayMatch } from "@/lib/match-display";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import type { Member, Guest, AttendanceSession } from "@/lib/supabase/database.types";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

type GuestModalTarget = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";

interface EditMatchModalProps {
  match: DisplayMatch;
  onClose: () => void;
  onSaved: () => void;
}

function toSelectedPlayer(p: DisplayMatch["teamAPlayer1"]): SelectedPlayer {
  return { id: p.id, name: p.name, isGuest: p.isGuest };
}

export function EditMatchModal({ match, onClose, onSaved }: EditMatchModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(match.session_id);
  const [loading, setLoading] = useState(true);

  const [teamAPlayer1, setTeamAPlayer1] = useState<SelectedPlayer | null>(
    toSelectedPlayer(match.teamAPlayer1)
  );
  const [teamAPlayer2, setTeamAPlayer2] = useState<SelectedPlayer | null>(
    toSelectedPlayer(match.teamAPlayer2)
  );
  const [teamBPlayer1, setTeamBPlayer1] = useState<SelectedPlayer | null>(
    toSelectedPlayer(match.teamBPlayer1)
  );
  const [teamBPlayer2, setTeamBPlayer2] = useState<SelectedPlayer | null>(
    toSelectedPlayer(match.teamBPlayer2)
  );

  const [scoreA, setScoreA] = useState(match.score_a);
  const [scoreB, setScoreB] = useState(match.score_b);
  const [tiebreakA, setTiebreakA] = useState(match.score_a_tiebreak ?? 0);
  const [tiebreakB, setTiebreakB] = useState(match.score_b_tiebreak ?? 0);
  const [winnerTeam, setWinnerTeam] = useState<"A" | "B">(match.winner_team);

  const [guestModalTarget, setGuestModalTarget] = useState<GuestModalTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const [{ data: memberData }, { data: guestData }, activeSessions] = await Promise.all([
        supabase.from("members").select("*").eq("is_active", true).eq("club_id", CHEONGWOO_CLUB_ID).order("name"),
        supabase
          .from("guests")
          .select("*")
          .eq("club_id", CHEONGWOO_CLUB_ID)
          .is("converted_to_member_id", null)
          .order("created_at", { ascending: false }),
        fetchActiveSessions(supabase),
      ]);
      setMembers(memberData ?? []);
      setGuests(guestData ?? []);

      let sessionList = activeSessions;
      // 이 경기에 이미 연결된 세션이 archived라서 목록에 없으면, 선택지가 사라지지 않도록 추가한다.
      if (match.session_id && !sessionList.some((s) => s.id === match.session_id)) {
        const { data: currentSession } = await supabase
          .from("attendance_sessions")
          .select("*")
          .eq("id", match.session_id)
          .eq("club_id", CHEONGWOO_CLUB_ID)
          .single();
        if (currentSession) {
          sessionList = [currentSession, ...sessionList];
        }
      }
      setSessions(sessionList);
      setLoading(false);
    }
    loadData();
  }, [match.session_id]);

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

    const res = await fetch(`/api/matches/${match.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: selectedSessionId,
        playedAt: match.played_at,
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
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-line-200 bg-line-100 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wide text-clay-400">경기 수정</p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-line-500">
            닫기
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-line-400">불러오는 중...</p>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-line-200 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-line-600">세션 *</p>
              <Dropdown
                align="left"
                triggerClassName="flex w-full items-center justify-between rounded-lg border border-line-200 bg-line-25 px-3 py-2.5 text-left"
                trigger={
                  <>
                    <span className="text-sm font-semibold text-line-900">
                      {selectedSessionLabel ?? "세션을 선택해주세요"}
                    </span>
                    <span className="text-line-500">▼</span>
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

            <div className="mb-3 rounded-lg border border-line-200 p-3">
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

            <div className="mb-3 rounded-lg border border-line-200 p-3">
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

            <div className="mb-3 rounded-lg border border-line-200 p-3">
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-line-600">
                스코어
              </p>
              <div className="flex items-center justify-center gap-6">
                <ScoreStepper label="청팀" value={scoreA} onChange={setScoreA} highlight={winnerTeam === "A"} max={7} />
                <span className="text-line-400">vs</span>
                <ScoreStepper label="우팀" value={scoreB} onChange={setScoreB} highlight={winnerTeam === "B"} max={7} />
              </div>

              {isTiebreakSet && (
                <div className="mt-3 border-t border-line-200 pt-3">
                  <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                    타이브레이크
                  </p>
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

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWinnerTeam("A")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    winnerTeam === "A"
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
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
                      : "border-line-200 text-line-600"
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
