"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlayerSelector, playerKey, type SelectedPlayer } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const [{ data: memberData }, { data: guestData }, sessionList] = await Promise.all([
      supabase.from("members").select("*").eq("is_active", true).eq("is_dormant", false).order("name"),
      supabase.from("guests").select("*").is("converted_to_member_id", null).order("created_at", { ascending: false }),
      fetchActiveSessions(supabase),
    ]);
    setMembers(memberData ?? []);
    setGuests(guestData ?? []);
    setSessions(sessionList);
    setLoading(false);
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
      </header>

      {/* ── 세션 선택 ─────────────────────────────────────── */}
      <div className="mb-8 rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <p className="mb-2 text-[11px] font-semibold text-line-500">세션 *</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-line-500">
            선택 가능한 출석 세션이 없어요. 출석 체크 화면에서 세션을 먼저 만들어주세요.
          </p>
        ) : (
          <Dropdown
            align="left"
            triggerClassName="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-100 px-3 py-2.5 text-left"
            trigger={
              <>
                <span className="text-sm font-semibold text-line-900">
                  {selectedSessionLabel ?? "세션을 선택해주세요"}
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
