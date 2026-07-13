"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PlayerSelector, playerKey, type SelectedPlayer } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { QuickGuestModal } from "@/components/match/QuickGuestModal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import { TEAM_LABEL, winnerLabel, scoreLabel } from "@/lib/match-team-labels";
import type { DisplayMatch } from "@/lib/match-display";
import type { Member, Guest, AttendanceSession } from "@/lib/supabase/database.types";

type Slot = "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2";

function toSelected(p: DisplayMatch["teamAPlayer1"]): SelectedPlayer {
  return { id: p.id, name: p.name, isGuest: p.isGuest };
}

export function EditMatchPageClient({
  match,
  currentClubId,
}: {
  match: DisplayMatch;
  currentClubId: string;
}) {
  const router = useRouter();
  const [members,  setMembers]  = useState<Member[]>([]);
  const [guests,   setGuests]   = useState<Guest[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(match.session_id);
  const [loading, setLoading]   = useState(true);

  const [p1A, setP1A] = useState<SelectedPlayer | null>(toSelected(match.teamAPlayer1));
  const [p2A, setP2A] = useState<SelectedPlayer | null>(toSelected(match.teamAPlayer2));
  const [p1B, setP1B] = useState<SelectedPlayer | null>(toSelected(match.teamBPlayer1));
  const [p2B, setP2B] = useState<SelectedPlayer | null>(toSelected(match.teamBPlayer2));

  const [scoreA, setScoreA] = useState(match.score_a);
  const [scoreB, setScoreB] = useState(match.score_b);
  const [tbA, setTbA] = useState(match.score_a_tiebreak ?? 0);
  const [tbB, setTbB] = useState(match.score_b_tiebreak ?? 0);
  const [winner, setWinner] = useState<"A" | "B">(match.winner_team);
  const [guestSlot, setGuestSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: mData }, { data: gData }, activeSessions] = await Promise.all([
        supabase.from("members").select("*").eq("is_active", true).eq("is_dormant", false).eq("club_id", currentClubId).order("nickname"),
        supabase.from("guests").select("*").eq("club_id", currentClubId).order("name"),
        fetchActiveSessions(supabase, currentClubId),
      ]);
      setMembers(mData ?? []);
      setGuests(gData ?? []);
      setSessions(activeSessions);
      setLoading(false);
    }
    load();
  }, [currentClubId]);

  const isTiebreak = (scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7);
  const all4 = [p1A, p2A, p1B, p2B];
  const allSelected = all4.every(Boolean);
  const allUnique   = allSelected && new Set(all4.map((p) => playerKey(p!.id, p!.isGuest))).size === 4;
  const selectedKeys = all4.filter(Boolean).map((p) => playerKey(p!.id, p!.isGuest));

  async function handleSave() {
    if (!allUnique) { toast.error("4명의 선수를 모두 다르게 선택해주세요."); return; }
    setSubmitting(true); setError(null);

    const res = await fetch(`/api/matches/${match.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        playedAt: match.played_at,
        teamAPlayer1: p1A, teamAPlayer2: p2A,
        teamBPlayer1: p1B, teamBPlayer2: p2B,
        scoreA, scoreB,
        scoreATiebreak: isTiebreak ? tbA : null,
        scoreBTiebreak: isTiebreak ? tbB : null,
        winnerTeam: winner,
      }),
    });

    const body = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) { setError(body?.error ?? "저장에 실패했습니다."); return; }
    toast.success("경기가 수정되었습니다.");
    router.push("/admin/matches");
    router.refresh();
  }

  const selectedSession = sessions.find((s) => s.id === sessionId);

  const sectionStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" } as const;
  const dividerStyle = { borderColor: "var(--admin-border)" } as const;

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="경기 기록 수정"
        description={`${match.played_at} 경기를 수정합니다.`}
        backHref="/admin/matches"
      />

      {loading ? (
        <div
          className="rounded-[var(--admin-card-radius,14px)] border p-8 text-center"
          style={sectionStyle}
        >
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 매치 선택 */}
          <section className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={sectionStyle}>
            <div className="border-b px-4 py-3" style={dividerStyle}>
              <p className="text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>매치</p>
            </div>
            <div className="px-4 py-3">
              <Dropdown align="left"
                triggerClassName="flex w-full items-center justify-between rounded-[var(--admin-button-radius,6px)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-raised,var(--admin-surface))] px-3 py-2 transition-colors hover:border-[color:var(--admin-border-strong)]"
                trigger={
                  <>
                    <span className="text-sm text-[color:var(--admin-text)]">
                      {selectedSession
                        ? `${selectedSession.title} · ${selectedSession.session_date}`
                        : "매치 없음"}
                    </span>
                    <span className="text-xs text-[color:var(--admin-muted)]">▼</span>
                  </>
                }>
                {(close) => (
                  <div className="max-h-48 overflow-y-auto">
                    <DropdownItem onClick={() => { setSessionId(null); close(); }}>
                      <span className={!sessionId ? "text-[color:var(--admin-accent)]" : ""}>세션 없음</span>
                    </DropdownItem>
                    {sessions.map((s) => (
                      <DropdownItem key={s.id} onClick={() => { setSessionId(s.id); close(); }}>
                        <span className={sessionId === s.id ? "text-[color:var(--admin-accent)]" : ""}>
                          {s.title} · {s.session_date} ({MATCH_SESSION_DAY_LABEL[s.session_day]})
                        </span>
                      </DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>
            </div>
          </section>

          {/* 청팀 */}
          <section className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={sectionStyle}>
            <div className="border-b px-4 py-3" style={dividerStyle}>
              <p className="text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>{TEAM_LABEL["A"]}</p>
            </div>
            <div className="space-y-2 px-4 py-3">
              <PlayerSelector label="첫 번째 선수" value={p1A} members={members} guests={guests}
                selectedKeys={selectedKeys} excludeKeys={[p2A, p1B, p2B].filter(Boolean).map((p) => playerKey(p!.id, p!.isGuest))}
                onChange={setP1A} onRequestAddGuest={() => setGuestSlot("teamAPlayer1")} />
              <PlayerSelector label="두 번째 선수" value={p2A} members={members} guests={guests}
                selectedKeys={selectedKeys} excludeKeys={[p1A, p1B, p2B].filter(Boolean).map((p) => playerKey(p!.id, p!.isGuest))}
                onChange={setP2A} onRequestAddGuest={() => setGuestSlot("teamAPlayer2")} />
            </div>
          </section>

          {/* 스코어 */}
          <section className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={sectionStyle}>
            <div className="border-b px-4 py-3" style={dividerStyle}>
              <p className="text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>스코어</p>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <ScoreStepper label={scoreLabel("A")} value={scoreA} onChange={setScoreA} max={7} />
                </div>
                <span className="font-score text-xl font-bold" style={{ color: "var(--admin-muted)" }}>:</span>
                <div className="flex-1">
                  <ScoreStepper label={scoreLabel("B")} value={scoreB} onChange={setScoreB} max={7} />
                </div>
              </div>
              {isTiebreak && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <ScoreStepper label={scoreLabel("A", true)} value={tbA} onChange={setTbA} />
                  </div>
                  <span className="font-score text-xl font-bold" style={{ color: "var(--admin-muted)" }}>:</span>
                  <div className="flex-1">
                    <ScoreStepper label={scoreLabel("B", true)} value={tbB} onChange={setTbB} />
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>승리 팀 선택</p>
                <div className="flex gap-2">
                  {(["A", "B"] as const).map((team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setWinner(team)}
                      className="flex-1 rounded-[var(--admin-button-radius,6px)] border py-2 text-sm font-bold transition-colors"
                      style={
                        winner === team
                          ? { borderColor: "var(--admin-achievement)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
                          : { borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-muted)" }
                      }
                    >
                      {winnerLabel(team)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 우팀 */}
          <section className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={sectionStyle}>
            <div className="border-b px-4 py-3" style={dividerStyle}>
              <p className="text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>{TEAM_LABEL["B"]}</p>
            </div>
            <div className="space-y-2 px-4 py-3">
              <PlayerSelector label="첫 번째 선수" value={p1B} members={members} guests={guests}
                selectedKeys={selectedKeys} excludeKeys={[p1A, p2A, p2B].filter(Boolean).map((p) => playerKey(p!.id, p!.isGuest))}
                onChange={setP1B} onRequestAddGuest={() => setGuestSlot("teamBPlayer1")} />
              <PlayerSelector label="두 번째 선수" value={p2B} members={members} guests={guests}
                selectedKeys={selectedKeys} excludeKeys={[p1A, p2A, p1B].filter(Boolean).map((p) => playerKey(p!.id, p!.isGuest))}
                onChange={setP2B} onRequestAddGuest={() => setGuestSlot("teamBPlayer2")} />
            </div>
          </section>

          {error && (
            <div className="rounded-sm border border-fault-400/30 bg-fault-400/5 px-4 py-3">
              <p className="text-sm text-fault-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/admin/matches"
              className="flex h-12 flex-1 items-center justify-center rounded-[var(--admin-button-radius,6px)] border text-sm font-semibold transition-colors hover:border-[color:var(--admin-border-strong)]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
            >
              취소
            </Link>
            <Button disabled={submitting || !allUnique} onClick={handleSave} className="flex-1 h-12">
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      )}

      {guestSlot && (
        <QuickGuestModal
          onClose={() => setGuestSlot(null)}
          onCreated={(guest) => {
            const p: SelectedPlayer = { id: guest.id, name: guest.name, isGuest: true };
            if (guestSlot === "teamAPlayer1") setP1A(p);
            else if (guestSlot === "teamAPlayer2") setP2A(p);
            else if (guestSlot === "teamBPlayer1") setP1B(p);
            else setP2B(p);
            setGuests((prev) => [...prev, guest]);
            setGuestSlot(null);
          }}
        />
      )}
    </main>
  );
}
