"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlayerSelector, playerKey, type SelectedPlayer } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import type { Member, Guest, AttendanceSession } from "@/lib/supabase/database.types";

type GuestModalTarget = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";

export default function NewMatchPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const [{ data: memberData }, { data: guestData }, sessionList] = await Promise.all([
      supabase
        .from("members")
        .select("*")
        .eq("is_active", true)
        .eq("is_dormant", false)
        .order("nickname"),
      supabase
        .from("guests")
        .select("*")
        .is("converted_to_member_id", null)
        .order("created_at", { ascending: false }),
      fetchActiveSessions(supabase),
    ]);
    setMembers(memberData ?? []);
    setGuests(guestData ?? []);
    setSessions(sessionList);
    setLoading(false);
  }

  const isTiebreakSet = (scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7);

  // 점수를 입력하면 승리팀을 자동으로 추정 (동점이면 수동 선택 유지)
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
    const selected: SelectedPlayer = { id: guest.id, nickname: guest.name, isGuest: true };

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
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          Match Result
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">경기 결과 입력</h1>
      </header>

      <Card className="mb-4 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-line-600">세션 선택 *</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-line-400">
            선택 가능한 출석 세션이 없어요. 출석 체크 화면에서 세션을 먼저 만들어주세요.
          </p>
        ) : (
          <Dropdown
            align="left"
            triggerClassName="flex w-full items-center justify-between rounded-lg border border-line-200 bg-line-25 px-4 py-3 text-left"
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
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {sessions.map((session) => {
                  const isCustom = session.session_day === "holiday" || session.session_day === "custom";
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
        )}
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-clay-400">청팀</p>
        <div className="space-y-3">
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
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-court-400">우팀</p>
        <div className="space-y-3">
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
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-line-600">스코어</p>
        <div className="flex items-center justify-center gap-6">
          <ScoreStepper
            label="청팀"
            value={scoreA}
            onChange={setScoreA}
            highlight={winnerTeam === "A"}
            max={7}
          />
          <span className="text-line-400">vs</span>
          <ScoreStepper
            label="우팀"
            value={scoreB}
            onChange={setScoreB}
            highlight={winnerTeam === "B"}
            max={7}
          />
        </div>

        {isTiebreakSet && (
          <div className="mt-4 border-t border-line-200 pt-4">
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

        <div className="mt-4 flex gap-2">
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
      </Card>

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
