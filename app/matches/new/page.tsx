"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlayerSelector } from "@/components/match/PlayerSelector";
import { ScoreStepper } from "@/components/match/ScoreStepper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Member } from "@/lib/supabase/database.types";

export default function NewMatchPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [teamAPlayer1, setTeamAPlayer1] = useState<string | null>(null);
  const [teamAPlayer2, setTeamAPlayer2] = useState<string | null>(null);
  const [teamBPlayer1, setTeamBPlayer1] = useState<string | null>(null);
  const [teamBPlayer2, setTeamBPlayer2] = useState<string | null>(null);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<"A" | "B" | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("members")
      .select("*")
      .eq("is_active", true)
      .order("nickname")
      .then(({ data }) => {
        setMembers(data ?? []);
        setLoadingMembers(false);
      });
  }, []);

  // 점수를 입력하면 승리팀을 자동으로 추정 (동점이면 수동 선택 유지)
  useEffect(() => {
    if (scoreA === scoreB) return;
    setWinnerTeam(scoreA > scoreB ? "A" : "B");
  }, [scoreA, scoreB]);

  const selectedIds = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2].filter(
    (id): id is string => id !== null
  );

  const isReadyToSubmit =
    teamAPlayer1 && teamAPlayer2 && teamBPlayer1 && teamBPlayer2 && winnerTeam && !submitting;

  async function handleSubmit() {
    if (!isReadyToSubmit) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playedAt: new Date().toISOString().slice(0, 10),
        teamAPlayer1,
        teamAPlayer2,
        teamBPlayer1,
        teamBPlayer2,
        scoreA,
        scoreB,
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

  if (loadingMembers) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-line-400">
        회원 목록을 불러오는 중...
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
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-clay-400">A팀</p>
        <div className="space-y-3">
          <PlayerSelector
            label="선수 1"
            members={members}
            selectedIds={selectedIds}
            excludeIds={selectedIds.filter((id) => id !== teamAPlayer1)}
            value={teamAPlayer1}
            onChange={setTeamAPlayer1}
          />
          <PlayerSelector
            label="선수 2"
            members={members}
            selectedIds={selectedIds}
            excludeIds={selectedIds.filter((id) => id !== teamAPlayer2)}
            value={teamAPlayer2}
            onChange={setTeamAPlayer2}
          />
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-court-400">B팀</p>
        <div className="space-y-3">
          <PlayerSelector
            label="선수 1"
            members={members}
            selectedIds={selectedIds}
            excludeIds={selectedIds.filter((id) => id !== teamBPlayer1)}
            value={teamBPlayer1}
            onChange={setTeamBPlayer1}
          />
          <PlayerSelector
            label="선수 2"
            members={members}
            selectedIds={selectedIds}
            excludeIds={selectedIds.filter((id) => id !== teamBPlayer2)}
            value={teamBPlayer2}
            onChange={setTeamBPlayer2}
          />
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-line-600">스코어</p>
        <div className="flex items-center justify-center gap-6">
          <ScoreStepper label="A팀" value={scoreA} onChange={setScoreA} highlight={winnerTeam === "A"} />
          <span className="text-line-400">vs</span>
          <ScoreStepper label="B팀" value={scoreB} onChange={setScoreB} highlight={winnerTeam === "B"} />
        </div>

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
            A팀 승리
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
            B팀 승리
          </button>
        </div>
      </Card>

      {error && <p className="mb-3 text-sm text-fault-400">{error}</p>}

      <Button
        size="lg"
        className="w-full"
        disabled={!isReadyToSubmit}
        onClick={handleSubmit}
      >
        {submitting ? "저장 중..." : "경기 결과 저장"}
      </Button>
    </main>
  );
}
