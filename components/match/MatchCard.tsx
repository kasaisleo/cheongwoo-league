"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import { EditMatchModal } from "@/components/match/EditMatchModal";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import type { DisplayMatch } from "@/lib/match-display";

interface MatchCardProps {
  match: DisplayMatch;
}

export function MatchCard({ match }: MatchCardProps) {
  const router = useRouter();
  // manager 이상만 수정/삭제 가능 — 권한 시스템 도입 전까지는 운영진 인증으로 대체
  // (useIsAdmin 훅이 /api/auth/status 조회를 담당한다)
  const isAdmin = useIsAdmin();
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("정말 이 경기를 삭제하시겠습니까?");
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/matches/${match.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeleting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "경기 삭제에 실패했습니다.");
      return;
    }

    toast.success("경기가 삭제되었습니다.");
    router.refresh();
  }

  return (
    <>
      <Card className="p-3">
        <div className="flex items-center justify-between text-xs text-line-400">
          <span>{match.played_at}</span>
          <div className="flex items-center gap-1.5">
            <Badge tone={match.winner_team === "A" ? "clay" : "court"}>
              {match.winner_team === "A" ? "청팀 승" : "우팀 승"}
            </Badge>
            {isAdmin && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="rounded-full border border-line-200 px-2 py-0.5 text-[11px] font-semibold text-line-600"
                >
                  수정
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="rounded-full border border-fault-400 px-2 py-0.5 text-[11px] font-semibold text-fault-400 disabled:opacity-40"
                >
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span
            className={match.winner_team === "A" ? "font-semibold text-line-900" : "text-line-500"}
          >
            {match.teamAPlayer1.nickname}
            {match.teamAPlayer1.isGuest && <span className="text-court-400"> G</span>} ·{" "}
            {match.teamAPlayer2.nickname}
            {match.teamAPlayer2.isGuest && <span className="text-court-400"> G</span>}
          </span>
          <span className="font-score font-bold text-line-900">
            {match.score_a} : {match.score_b}
            {match.score_a_tiebreak !== null && (
              <span className="ml-1 text-xs font-normal text-line-500">
                ({match.score_a_tiebreak}-{match.score_b_tiebreak})
              </span>
            )}
          </span>
          <span
            className={match.winner_team === "B" ? "font-semibold text-line-900" : "text-line-500"}
          >
            {match.teamBPlayer1.nickname}
            {match.teamBPlayer1.isGuest && <span className="text-court-400"> G</span>} ·{" "}
            {match.teamBPlayer2.nickname}
            {match.teamBPlayer2.isGuest && <span className="text-court-400"> G</span>}
          </span>
        </div>
      </Card>

      {showEditModal && (
        <EditMatchModal
          match={match}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
