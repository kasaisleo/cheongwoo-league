"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { toast } from "@/components/ui/Toast";
import { EditMatchModal } from "@/components/match/EditMatchModal";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { DisplayMatch } from "@/lib/match-display";

/**
 * MatchCard v3 — ATP Design Language Rollout (Step 17).
 *
 * v2 → v3 변경:
 *   Surface:    Card(bg-line-100) → div(bg-line-50) — 앱 전체 surface 통일
 *   승자 배경:  bg-win/5(초록 5%) → bg-gold/5(금 5%) — W=gold 원칙 적용
 *               색차 분석: bg-gold/5 = 색차 11.4 (미묘, 배경이 배지보다 먼저 보이지 않음)
 *   수정 버튼:  rounded-full → rounded-sm, border-line-200 → border-line-200/40
 *   삭제 버튼:  border-fault-400 text-fault-400 → border-line-200/40 text-line-500
 *               (fault Legacy 제거 — confirm 다이얼로그가 이미 안전장치)
 *   게스트 G:   text-court-400 → text-line-500 (Legacy court 제거)
 *
 * 유지:
 *   WIN / LOSS 배지 — ResultBadge 수정 없음, 초록/빨강 유지
 *   승자 이름: font-semibold text-line-900 ✅
 *   패자 이름: font-normal text-line-500   ✅
 *   운영진 수정/삭제 기능 — 로직 변경 없음
 */

interface MatchCardProps {
  match: DisplayMatch;
}

interface TeamRowData {
  player1: { name: string; isGuest: boolean };
  player2: { name: string; isGuest: boolean };
  score: number;
  tiebreak: number | null;
  opponentScore: number;
  opponentTiebreak: number | null;
}

export function MatchCard({ match }: MatchCardProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const aWon = match.winner_team === "A";

  const teamAData: TeamRowData = {
    player1: match.teamAPlayer1,
    player2: match.teamAPlayer2,
    score: match.score_a,
    tiebreak: match.score_a_tiebreak,
    opponentScore: match.score_b,
    opponentTiebreak: match.score_b_tiebreak,
  };
  const teamBData: TeamRowData = {
    player1: match.teamBPlayer1,
    player2: match.teamBPlayer2,
    score: match.score_b,
    tiebreak: match.score_b_tiebreak,
    opponentScore: match.score_a,
    opponentTiebreak: match.score_a_tiebreak,
  };

  const winnerData = aWon ? teamAData : teamBData;
  const loserData  = aWon ? teamBData : teamAData;

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
      {/* ── Card surface: bg-line-50 (앱 전체 통일) ── */}
      <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

        {/* ── 상단 메타 바 ────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 border-b border-line-200/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-line-500">
            <span className="shrink-0 tabular-nums">{match.played_at}</span>
            {match.sessionDay && (
              <>
                <span className="text-line-300">·</span>
                <span className="truncate">
                  {match.sessionTitle
                    ? match.sessionTitle
                    : MATCH_SESSION_DAY_LABEL[match.sessionDay]}
                </span>
              </>
            )}
          </div>

          {/* 운영진 버튼 — 보조 기능, gray로 조용하게 */}
          {isAdmin && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[11px] font-semibold text-line-500"
              >
                수정
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[11px] font-semibold text-line-500 disabled:opacity-40"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          )}
        </div>

        {/* ── 승자 행 (bg-gold/5 — 색차 11.4, 미묘) ── */}
        <TeamRow data={winnerData} isWinner />

        <div className="border-t border-line-200/30" />

        {/* ── 패자 행 ─────────────────────────────────── */}
        <TeamRow data={loserData} isWinner={false} />

      </div>

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

function TeamRow({
  data,
  isWinner,
}: {
  data: TeamRowData;
  isWinner: boolean;
}) {
  const scoreText = `${data.score} : ${data.opponentScore}`;
  const hasTiebreak = data.tiebreak !== null && data.opponentTiebreak !== null;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 ${
        isWinner ? "bg-gold/5" : ""
      }`}
    >
      {/* WIN / LOSS 배지 — ResultBadge 유지, 색상 변경 없음 */}
      <ResultBadge result={isWinner ? "win" : "loss"} size="sm" />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            isWinner
              ? "font-semibold text-line-900"
              : "font-normal text-line-500"
          }`}
        >
          <PlayerName player={data.player1} />
          <span className="mx-1 text-line-400">·</span>
          <PlayerName player={data.player2} />
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span
          className={`font-score text-sm font-bold tabular-nums ${
            isWinner ? "text-line-900" : "text-line-500"
          }`}
        >
          {scoreText}
        </span>
        {hasTiebreak && (
          <span className="ml-1 font-score text-[10px] font-normal text-line-500">
            ({data.tiebreak}-{data.opponentTiebreak})
          </span>
        )}
      </div>
    </div>
  );
}

function PlayerName({
  player,
}: {
  player: { name: string; isGuest: boolean };
}) {
  return (
    <>
      {player.name}
      {player.isGuest && (
        /* 게스트 G: court-400(Legacy) → text-line-500(muted) */
        <span className="ml-0.5 font-score text-[10px] font-bold text-line-500">
          G
        </span>
      )}
    </>
  );
}
