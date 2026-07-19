"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { judgeMatchStatus, type MatchStatus } from "@/lib/records/matchStatus";
import { pct, fmtPct } from "@/lib/records/dashboardUtils";


const STATUS_STYLE: Record<MatchStatus, CSSProperties> = {
  "정상":    { borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-muted)", opacity: 0.7 },
  "확인 필요": { borderColor: "rgba(201,168,76,0.4)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" },
  "기록 부족": { borderColor: "rgba(212,120,60,0.4)", background: "rgba(212,120,60,0.1)", color: "#d4783c" },
  "완료 전":  { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" },
};

// ── 선수별 상태 ───────────────────────────────────────────────────
type PlayerStatus = "경기 참여" | "미참여" | "미출석" | "출석 후 미참여";

export interface PlayerStatusRow {
  memberId: string;
  name: string;
  status: PlayerStatus;
}

// ── 세션 요약 타입 ────────────────────────────────────────────────
export interface SessionSummary {
  session: {
    id: string;
    title: string;
    session_date: string;
    session_day: string;
    status: string;
  };
  isCompleted: boolean;
  gameCount: number;
  attendingCount: number;
  absentCount: number;
  undecidedCount: number;
  noResponseCount: number;
  gameParticipantCount: number;
  noShowCount: number;
  noShowMembers: string[];
  matchStatus: MatchStatus;
}

interface MatchRecordsPageClientProps {
  summaries: SessionSummary[];
  totalMembersCount: number;
  /** 세션별 선수 상태(펼침 UI) — 서버에서 전량 미리 계산해 전달, 재조회 없음. */
  playerRowsBySession: Record<string, PlayerStatusRow[]>;
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function MatchRecordsPageClient({
  summaries,
  totalMembersCount,
  playerRowsBySession,
}: MatchRecordsPageClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MatchStatus | "전체">("전체");

  function toggleExpand(sid: string) {
    setExpandedId((prev) => (prev === sid ? null : sid));
  }

  function sessionTitle(s: SessionSummary["session"]) {
    const base = MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? s.title;
    return (s.session_day === "holiday" || s.session_day === "custom") ? `${base} · ${s.title}` : base;
  }

  const PLAYER_STATUS_STYLE: Record<PlayerStatus, CSSProperties> = {
    "경기 참여":    { color: "var(--admin-achievement)" },
    "출석 후 미참여": { color: "#d4783c" },
    "미참여":      { color: "var(--admin-muted)", opacity: 0.7 },
    "미출석":      { color: "var(--admin-muted)", opacity: 0.5 },
  };

  const STATUS_FILTERS: (MatchStatus | "전체")[] = ["전체", "확인 필요", "기록 부족", "완료 전", "정상"];

  const filtered = filterStatus === "전체" ? summaries : summaries.filter((s) => s.matchStatus === filterStatus);

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="경기 검수"
        description="경기 기록 누락과 이상을 검수합니다."
        backHref="/admin/records"
      />

      {/* 상태 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilterStatus(f)}
            className="rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors"
            style={filterStatus === f
              ? { borderColor: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
              : { borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--admin-card-radius,14px)] border p-6 text-center" style={cardStyle}>
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>해당 상태의 매치가 없어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.session.id} className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>

              {/* 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(s.session.id)}
                className="flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>
                      {s.session.session_date}
                    </span>
                    <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={STATUS_STYLE[s.matchStatus]}>
                      {s.matchStatus}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{sessionTitle(s.session)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span style={{ color: "var(--admin-achievement)" }}>{s.gameParticipantCount}명 경기 참여</span>
                    <span style={{ color: "var(--admin-muted)" }}>{s.gameCount}경기</span>
                    {s.noShowCount > 0 && (
                      <span style={{ color: "#d4783c" }}>출석 후 미참여 {s.noShowCount}명</span>
                    )}
                    {s.noResponseCount > 0 && (
                      <span style={{ color: "var(--admin-muted)", opacity: 0.6 }}>미출석 {s.noResponseCount}명</span>
                    )}
                    {!s.isCompleted && (
                      <span style={{ color: "var(--admin-muted)" }}>진행 중</span>
                    )}
                  </div>
                </div>
                <div className="ml-3 flex flex-shrink-0 flex-col items-end gap-1.5">
                  {s.isCompleted && s.gameCount === 0 && (
                    <Link href={`/admin/matches/new?sessionId=${s.session.id}`}
                      className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                      style={{ borderColor: "rgba(212,120,60,0.6)", background: "rgba(212,120,60,0.1)", color: "#d4783c" }}
                      onClick={(e) => e.stopPropagation()}>
                      결과 입력
                    </Link>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{expandedId === s.session.id ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* 출석 통계 바 */}
              <div className="border-t px-4 py-2" style={{ borderColor: "var(--admin-border)" }}>
                <div className="flex items-center gap-3 text-[10px]">
                  <span style={{ color: "var(--admin-achievement)" }}>출석 {s.attendingCount}</span>
                  <span style={{ color: "#d4783c" }}>미정 {s.undecidedCount}</span>
                  <span style={{ color: "var(--admin-muted)", opacity: 0.7 }}>불참 {s.absentCount}</span>
                  <span style={{ color: "var(--admin-muted)", opacity: 0.5 }}>미응답 {s.noResponseCount}</span>
                  <span className="ml-auto" style={{ color: "var(--admin-muted)" }}>
                    출석 체크율 {fmtPct(pct(s.attendingCount + s.absentCount + s.undecidedCount, totalMembersCount))}
                  </span>
                </div>
              </div>

              {/* 상세 — 선수별 상태, 서버에서 미리 계산된 데이터 */}
              {expandedId === s.session.id && (() => {
                const playerRows = playerRowsBySession[s.session.id] ?? [];
                return (
                  <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--admin-border)" }}>
                    <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                      선수별 상태 ({playerRows.length}명)
                    </p>
                    <div className="space-y-0.5">
                      {playerRows.map((r) => (
                        <div key={r.memberId} className="flex items-center justify-between py-1">
                          <span className="text-[14px] font-semibold" style={{ color: "var(--admin-text)" }}>{r.name}</span>
                          <span className="text-[11px] font-semibold" style={PLAYER_STATUS_STYLE[r.status]}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    {s.gameCount > 0 && (
                      <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--admin-border)" }}>
                        <Link href="/admin/matches" className="text-[10px] font-semibold transition-colors hover:text-[color:var(--admin-text)]" style={{ color: "var(--admin-muted)" }}>
                          경기 기록 관리 →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
