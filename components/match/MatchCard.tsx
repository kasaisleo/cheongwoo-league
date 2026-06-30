"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { toast } from "@/components/ui/Toast";
import { EditMatchModal } from "@/components/match/EditMatchModal";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { DisplayMatch } from "@/lib/match-display";

/**
 * MatchCard v2 — ATP 스타일 경기 결과 카드 (Step 15-3).
 *
 * 변경 전:
 *   1행 가로 레이아웃 — "팀A · 팀B | 점수 | 청팀 승/우팀 승 배지"
 *   누가 이겼는지 0.3초 안에 읽기 어려움
 *
 * 변경 후:
 *   2행 세로 레이아웃
 *   ┌──────────────────────────────────┐
 *   │ 날짜  ·  세션명           [수정][삭제]│ ← 상단 메타 바
 *   ├──────────────────────────────────┤
 *   │ [WIN]  김경희 · 홍길동    6 : 3  │ ← 승자 행 (bg-win/5)
 *   ├──────────────────────────────────┤
 *   │ [LOSS] 박민수 · 이지영    3 : 6  │ ← 패자 행
 *   └──────────────────────────────────┘
 *
 * 승자를 항상 위에 표시 — winner_team A/B에 관계없이 재정렬.
 *
 * LP 변동: DisplayMatch에 LP 데이터가 없어 이번 Step에서 생략.
 *   point_history 조인이 추가되면 LpBadge를 하단 메타 바에 추가 예정.
 *
 * 기존 기능 전부 유지:
 *   useIsAdmin(), 수정/삭제 버튼, EditMatchModal, 게스트 G 표시
 */

interface MatchCardProps {
  match: DisplayMatch;
}

/** 팀 행 데이터 구조 */
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

  // 승자를 항상 위에 표시
  const winnerData = aWon ? teamAData : teamBData;
  const loserData = aWon ? teamBData : teamAData;

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
      <Card className="overflow-hidden p-0">

        {/* ── 상단 메타 바 ──────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 border-b border-line-200/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-line-500">
            <span className="shrink-0 tabular-nums">{match.played_at}</span>
            {match.sessionDay && (
              <>
                <span className="text-line-300">·</span>
                <span className="truncate">
                  {/* Step 14 세션 제목 정책: title 메인, session_day 보조 */}
                  {match.sessionTitle
                    ? match.sessionTitle
                    : MATCH_SESSION_DAY_LABEL[match.sessionDay]}
                </span>
              </>
            )}
          </div>
          {isAdmin && (
            <div className="flex shrink-0 gap-1">
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

        {/* ── 승자 행 (bg-win/5 미묘한 초록 배경) ────────── */}
        <TeamRow data={winnerData} isWinner />

        <div className="border-t border-line-200/30" />

        {/* ── 패자 행 ───────────────────────────────────── */}
        <TeamRow data={loserData} isWinner={false} />

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

/** 팀 행 — WIN/LOSS 배지 + 선수 이름 + 점수 */
function TeamRow({
  data,
  isWinner,
}: {
  data: TeamRowData;
  isWinner: boolean;
}) {
  // 점수 표기: "6 : 3" 또는 "6 : 7 (5-7)" — 타이브레이크 포함
  const scoreText = `${data.score} : ${data.opponentScore}`;
  const hasTiebreak = data.tiebreak !== null && data.opponentTiebreak !== null;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 ${
        isWinner ? "bg-win/5" : ""
      }`}
    >
      {/* WIN / LOSS 배지 — 가장 왼쪽, 결과를 0.3초 안에 인식 */}
      <ResultBadge result={isWinner ? "win" : "loss"} size="sm" />

      {/* 선수 이름 — 복식 2명, 게스트 G 표시 */}
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

      {/* 점수 — 우측 고정, 모노스페이스 tabular-nums */}
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

/** 선수 이름 표시 — 게스트이면 G 배지 추가 */
function PlayerName({
  player,
}: {
  player: { name: string; isGuest: boolean };
}) {
  return (
    <>
      {player.name}
      {player.isGuest && (
        <span className="ml-0.5 font-score text-[10px] font-bold text-court-400">
          G
        </span>
      )}
    </>
  );
}
