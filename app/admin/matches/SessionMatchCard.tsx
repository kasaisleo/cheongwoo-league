"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteMatchButton } from "./DeleteMatchButton";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { TEAM_LABEL } from "@/lib/match-team-labels";
import type { DisplayMatch } from "@/lib/match-display";

// ── 운영 상태 배지 ────────────────────────────────────────────────
type OpsStatus = "예정" | "진행 중" | "완료 필요" | "완료";

function getOpsStatus(sessionStatus: string, sessionDate: string, matchCount: number): OpsStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (sessionStatus === "closed") return "완료";
  if (sessionStatus === "archived") return "완료";
  if (sessionDate < today) return matchCount === 0 ? "완료 필요" : "완료 필요";
  if (sessionDate === today) return "진행 중";
  return "예정";
}

const OPS_STATUS_STYLE: Record<OpsStatus, string> = {
  "예정":    "border-line-200/40 bg-line-50 text-line-500",
  "진행 중": "border-gold/40 bg-gold/10 text-gold",
  "완료 필요": "border-clay-400/40 bg-clay-400/10 text-clay-400",
  "완료":   "border-line-200/40 bg-line-100 text-line-400",
};

// ── 매치 유형 배지 ────────────────────────────────────────────────
const MATCH_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  saturday: { label: "토요 정기", cls: "border-clay-400/40 bg-clay-400/10 text-clay-400" },
  sunday:   { label: "일요 정기", cls: "border-clay-400/40 bg-clay-400/10 text-clay-400" },
  holiday:  { label: "휴일",     cls: "border-gold/40 bg-gold/10 text-gold" },
  custom:   { label: "이벤트",   cls: "border-line-300/40 bg-line-100 text-line-500" },
};

// ── 선수명 헬퍼 ──────────────────────────────────────────────────
const EMPTY = new Set(["", "알수없음", "알 수 없음", "unknown", "Unknown"]);
function playerName(name: string | null | undefined) {
  return name && !EMPTY.has(name) ? name : "미지정";
}

// ── 세션 히스토리 카드 ────────────────────────────────────────────
export interface SessionGroup {
  sessionId: string;
  sessionDate: string;
  sessionDay: string;
  sessionTitle: string;
  sessionStatus: string;
  // 출석 현황
  attendingCount: number;
  undecidedCount: number;
  absentCount: number;
  noResponseCount: number;
  // 경기 목록
  matches: DisplayMatch[];
  // 권한
  canEdit: boolean;
  canDelete: boolean;
}

export function SessionMatchCard({ group }: { group: SessionGroup }) {
  const [open, setOpen] = useState(false);

  const {
    sessionId, sessionDate, sessionDay, sessionTitle, sessionStatus,
    attendingCount, undecidedCount, absentCount, noResponseCount,
    matches, canEdit, canDelete,
  } = group;

  const opsStatus = getOpsStatus(sessionStatus, sessionDate, matches.length);
  const typeBadge = MATCH_TYPE_BADGE[sessionDay] ?? { label: "기타", cls: "border-line-200/40 bg-line-50 text-line-500" };
  const sessionLabel = MATCH_SESSION_DAY_LABEL[sessionDay as keyof typeof MATCH_SESSION_DAY_LABEL] ?? sessionTitle;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

      {/* ── 카드 헤더 */}
      <div className="px-4 pt-4 pb-3">
        {/* 날짜 + 배지들 */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="font-score text-[11px] font-bold tabular-nums text-line-400">{sessionDate}</span>
          <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${typeBadge.cls}`}>
            {typeBadge.label}
          </span>
          <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${OPS_STATUS_STYLE[opsStatus]}`}>
            {opsStatus}
          </span>
        </div>

        {/* 매치명 */}
        <p className="text-[15px] font-semibold leading-snug text-line-900">{sessionLabel}</p>

        {/* 출석 현황 */}
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px]">
          <span className="text-gold">출석 {attendingCount}</span>
          <span className="text-line-500">미정 {undecidedCount}</span>
          <span className="text-line-400">불참 {absentCount}</span>
          {noResponseCount > 0 && <span className="text-line-300">미응답 {noResponseCount}</span>}
          <span className="ml-auto text-line-600"><span className="font-score tabular-nums">{matches.length}</span><span className="unit-kr">경기</span></span>
        </div>
      </div>

      {/* ── CTA 버튼 행 */}
      <div className="flex flex-wrap gap-1.5 border-t border-line-200/30 px-4 py-2.5">
        <Link href={`/admin/attendance?session_id=${sessionId}`}
          className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
          출석 관리
        </Link>
        <Link href={`/matches/new?sessionId=${sessionId}`}
          className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/20">
          결과 추가
        </Link>
        <Link href="/admin/records/matches"
          className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 hover:border-line-300">
          기록 검수
        </Link>
      </div>

      {/* ── 경기 히스토리 접힘/펼침 */}
      <div className="border-t border-line-200/30">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-line-100/40">
          <span className="text-[10px] font-bold text-line-500">
            <span className="status-kr">경기 히스토리</span>{" "}
            {matches.length > 0
              ? <><span className="font-score tabular-nums">{matches.length}</span><span className="unit-kr">경기</span></>
              : <span className="status-kr">없음</span>}
          </span>
          <span className="text-[10px] text-line-400">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="border-t border-line-200/20 px-4 pb-4 pt-3">
            {matches.length === 0 ? (
              <p className="py-2 text-center text-sm text-line-400">입력된 경기 기록이 없어요.</p>
            ) : (
              <div className="space-y-3">
                {matches.map((m, idx) => {
                  const winner = m.winner_team as "A" | "B" | null ?? null;
                  const aWin = winner === "A";
                  const bWin = winner === "B";
                  return (
                    <div key={m.id} className="rounded-[10px] border border-line-200/30 bg-line-100/40 px-3 py-3">
                      {/* 경기 번호 + 수정/삭제 */}
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-display text-[9px] font-bold uppercase tracking-widest text-line-400">
                          {idx + 1}경기
                        </span>
                        <div className="flex gap-1">
                          {canEdit && (
                            <Link href={`/admin/matches/${m.id}/edit`}
                              className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
                              수정
                            </Link>
                          )}
                          {canDelete && <DeleteMatchButton matchId={m.id} playedAt={m.played_at} />}
                        </div>
                      </div>

                      {/* 스코어 */}
                      <div className="flex items-center justify-center gap-4">
                        {/* 청팀 */}
                        <div className={`flex flex-col items-center ${winner && !aWin ? "opacity-50" : ""}`}>
                          <span className="text-[9px] font-bold text-clay-400">{TEAM_LABEL["A"]}</span>
                          <div className="flex items-center gap-1">
                            <span className={`font-score text-2xl font-bold tabular-nums ${aWin ? "text-gold" : "text-line-500"}`}>
                              {m.score_a ?? "—"}
                            </span>
                            {aWin && <span className="rounded-sm bg-gold/10 px-1 py-0.5 text-[8px] font-bold text-gold">WIN</span>}
                          </div>
                          <p className="mt-0.5 text-center text-[11px] font-semibold text-line-800">
                            {playerName(m.teamAPlayer1.name)}<br />
                            {playerName(m.teamAPlayer2.name)}
                          </p>
                        </div>

                        <span className="font-score text-base font-bold text-line-400">:</span>

                        {/* 우팀 */}
                        <div className={`flex flex-col items-center ${winner && !bWin ? "opacity-50" : ""}`}>
                          <span className="text-[9px] font-bold text-clay-400">{TEAM_LABEL["B"]}</span>
                          <div className="flex items-center gap-1">
                            {bWin && <span className="rounded-sm bg-gold/10 px-1 py-0.5 text-[8px] font-bold text-gold">WIN</span>}
                            <span className={`font-score text-2xl font-bold tabular-nums ${bWin ? "text-gold" : "text-line-500"}`}>
                              {m.score_b ?? "—"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-center text-[11px] font-semibold text-line-800">
                            {playerName(m.teamBPlayer1.name)}<br />
                            {playerName(m.teamBPlayer2.name)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
