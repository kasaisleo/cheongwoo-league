"use client";

import type { CSSProperties } from "react";
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

const OPS_STATUS_STYLE: Record<OpsStatus, CSSProperties> = {
  "예정":     { borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-muted)" },
  "진행 중":  { borderColor: "rgba(201,168,76,0.45)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" },
  "완료 필요":{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" },
  "완료":     { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-muted)", opacity: 0.7 },
};

// ── 매치 유형 배지 ────────────────────────────────────────────────
const MATCH_TYPE_BADGE: Record<string, { label: string; style: CSSProperties }> = {
  saturday: { label: "토요 정기", style: { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" } },
  sunday:   { label: "일요 정기", style: { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" } },
  holiday:  { label: "휴일",     style: { borderColor: "rgba(201,168,76,0.45)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" } },
  custom:   { label: "이벤트",   style: { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-muted)" } },
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
  attendingCount: number;
  undecidedCount: number;
  absentCount: number;
  noResponseCount: number;
  matches: DisplayMatch[];
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
  const typeBadge = MATCH_TYPE_BADGE[sessionDay] ?? {
    label: "기타",
    style: { borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-muted)" },
  };
  const sessionLabel = MATCH_SESSION_DAY_LABEL[sessionDay as keyof typeof MATCH_SESSION_DAY_LABEL] ?? sessionTitle;

  const borderStyle: CSSProperties = { borderColor: "var(--admin-border)" };
  const surfaceStyle: CSSProperties = { background: "var(--admin-surface)", borderColor: "var(--admin-border)" };
  const raisedStyle: CSSProperties = { background: "var(--admin-surface-raised, var(--admin-surface))", borderColor: "var(--admin-border)" };

  return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>

      {/* ── 카드 헤더 */}
      <div className="px-4 pt-4 pb-3">
        {/* 날짜 + 배지들 */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="font-score text-[11px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>
            {sessionDate}
          </span>
          <span
            className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold"
            style={typeBadge.style}
          >
            {typeBadge.label}
          </span>
          <span
            className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold"
            style={OPS_STATUS_STYLE[opsStatus]}
          >
            {opsStatus}
          </span>
        </div>

        {/* 매치명 */}
        <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>
          {sessionLabel}
        </p>

        {/* 출석 현황 */}
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px]">
          <span style={{ color: "var(--admin-achievement)" }}>출석 {attendingCount}</span>
          <span style={{ color: "var(--admin-muted)" }}>미정 {undecidedCount}</span>
          <span style={{ color: "var(--admin-muted)", opacity: 0.7 }}>불참 {absentCount}</span>
          {noResponseCount > 0 && (
            <span style={{ color: "var(--admin-muted)", opacity: 0.5 }}>미응답 {noResponseCount}</span>
          )}
          <span className="ml-auto" style={{ color: "var(--admin-muted)" }}>
            <span className="font-score tabular-nums">{matches.length}</span>
            <span className="unit-kr">경기</span>
          </span>
        </div>
      </div>

      {/* ── CTA 버튼 행 */}
      <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5" style={borderStyle}>
        <Link
          href={`/admin/attendance?session_id=${sessionId}`}
          className="rounded-sm border border-clay-400/30 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/10"
        >
          출석 관리
        </Link>
        <Link
          href={`/admin/matches/new?sessionId=${sessionId}`}
          className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 hover:bg-clay-400/20"
        >
          결과 추가
        </Link>
        <Link
          href="/admin/records/matches"
          className="rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          기록 검수
        </Link>
      </div>

      {/* ── 경기 히스토리 접힘/펼침 */}
      <div className="border-t" style={borderStyle}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-opacity hover:opacity-70"
        >
          <span className="text-[10px] font-bold" style={{ color: "var(--admin-muted)" }}>
            <span className="status-kr">경기 히스토리</span>{" "}
            {matches.length > 0
              ? <><span className="font-score tabular-nums">{matches.length}</span><span className="unit-kr">경기</span></>
              : <span className="status-kr">없음</span>}
          </span>
          <span className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="border-t px-4 pb-4 pt-3" style={borderStyle}>
            {matches.length === 0 ? (
              <p className="py-2 text-center text-sm" style={{ color: "var(--admin-muted)" }}>
                입력된 경기 기록이 없어요.
              </p>
            ) : (
              <div className="space-y-3">
                {matches.map((m, idx) => {
                  const winner = m.winner_team as "A" | "B" | null ?? null;
                  const aWin = winner === "A";
                  const bWin = winner === "B";
                  return (
                    <div key={m.id} className="rounded-[10px] border px-3 py-3" style={raisedStyle}>
                      {/* 경기 번호 + 수정/삭제 */}
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                          {idx + 1}경기
                        </span>
                        <div className="flex gap-1">
                          {canEdit && (
                            <Link
                              href={`/admin/matches/${m.id}/edit`}
                              className="rounded-sm border border-clay-400/30 px-2 py-0.5 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/10"
                            >
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
                            <span
                              className="font-score text-2xl font-bold tabular-nums"
                              style={{ color: aWin ? "var(--admin-achievement)" : "var(--admin-muted)" }}
                            >
                              {m.score_a ?? "—"}
                            </span>
                            {aWin && (
                              <span
                                className="rounded-sm px-1 py-0.5 text-[8px] font-bold"
                                style={{ background: "rgba(201,168,76,0.12)", color: "var(--admin-achievement)" }}
                              >
                                WIN
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-center text-[11px] font-semibold" style={{ color: "var(--admin-text)" }}>
                            {playerName(m.teamAPlayer1.name)}<br />
                            {playerName(m.teamAPlayer2.name)}
                          </p>
                        </div>

                        <span className="font-score text-base font-bold" style={{ color: "var(--admin-muted)" }}>:</span>

                        {/* 우팀 */}
                        <div className={`flex flex-col items-center ${winner && !bWin ? "opacity-50" : ""}`}>
                          <span className="text-[9px] font-bold text-clay-400">{TEAM_LABEL["B"]}</span>
                          <div className="flex items-center gap-1">
                            {bWin && (
                              <span
                                className="rounded-sm px-1 py-0.5 text-[8px] font-bold"
                                style={{ background: "rgba(201,168,76,0.12)", color: "var(--admin-achievement)" }}
                              >
                                WIN
                              </span>
                            )}
                            <span
                              className="font-score text-2xl font-bold tabular-nums"
                              style={{ color: bWin ? "var(--admin-achievement)" : "var(--admin-muted)" }}
                            >
                              {m.score_b ?? "—"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-center text-[11px] font-semibold" style={{ color: "var(--admin-text)" }}>
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
