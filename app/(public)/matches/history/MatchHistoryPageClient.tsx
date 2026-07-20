"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import { MATCH_SESSION_DAY_LABEL, type SessionSummary as AttendanceSessionSummary } from "@/lib/match-session-label";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import type { MemberType } from "@/lib/supabase/database.types";

// ── 타입 ─────────────────────────────────────────────────────────
interface SessionSummary {
  session: AttendanceSessionSummary;
  matchCount: number;
}

/** /api/matches/public 세션 모드 응답의 records[] 항목 — 서버에서 이미 집계·정렬됨. */
interface PlayerRecord {
  displayName: string;
  isGuest: boolean;
  memberType: MemberType | null;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
}

// ── 유틸 ─────────────────────────────────────────────────────────
function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  if (isGuest) {
    return (
      <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
        게스트
      </span>
    );
  }
  if (memberType === "준회원") {
    return (
      <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
        준회원
      </span>
    );
  }
  // 정회원은 배지 생략 (기본값)
  return null;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function MatchHistoryPageClient({ currentClubId }: { currentClubId: string }) {
  const isAdmin = useIsAdmin();

  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);

  // ── 매치 목록 로드 ──────────────────────────────────────────────
  async function loadSummaries() {
    setLoading(true);
    const sessionParams = new URLSearchParams({ clubId: currentClubId, statuses: "closed,archived", order: "desc" });
    const sessionList = await fetch(`/api/attendance/public-sessions?${sessionParams}`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((body) => body.sessions as AttendanceSessionSummary[])
      .catch(() => {
        console.error("[MatchHistoryPageClient] public-sessions 조회 실패");
        return [] as AttendanceSessionSummary[];
      });

    const sessionIds = sessionList.map((s) => s.id);

    const counts: Record<string, number> = sessionIds.length > 0
      ? await fetch(
          `/api/matches/public?${new URLSearchParams({ clubId: currentClubId, mode: "counts", sessionIds: sessionIds.join(",") })}`
        )
          .then((res) => (res.ok ? res.json() : { counts: {} }))
          .then((body) => body.counts as Record<string, number>)
          .catch(() => {
            console.error("[MatchHistoryPageClient] matches/public counts 조회 실패");
            return {};
          })
      : {};

    setSummaries(sessionList.map((session) => ({
      session,
      matchCount: counts[session.id] ?? 0,
    })));
    setLoading(false);
  }

  useEffect(() => { loadSummaries(); }, [currentClubId]);

  // ── 상세 — 참석자별 기록(서버에서 이미 집계됨) ──────────────────
  async function toggleExpand(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setPlayerRecords([]);
      return;
    }
    setExpandedSessionId(sessionId);
    setLoadingDetail(true);

    const records = await fetch(
      `/api/matches/public?${new URLSearchParams({ clubId: currentClubId, sessionId })}`
    )
      .then((res) => (res.ok ? res.json() : { records: [] }))
      .then((body) => body.records as PlayerRecord[])
      .catch(() => {
        console.error("[MatchHistoryPageClient] matches/public 세션 조회 실패");
        return [] as PlayerRecord[];
      });

    setPlayerRecords(records);
    setLoadingDetail(false);
  }

  // ── 복원 ────────────────────────────────────────────────────────
  async function handleRestoreSession(sessionId: string) {
    if (!window.confirm("이 매치를 복원하고 출석 수정이 가능한 상태로 되돌릴까요?")) return;
    setRestoringSessionId(sessionId);
    const res = await fetch("/api/attendance-sessions/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetStatus: "closed" }),
    });
    const body = await res.json().catch(() => null);
    setRestoringSessionId(null);
    if (!res.ok) { toast.error(body?.error ?? "복원에 실패했습니다."); return; }
    toast.success("매치가 복원되었습니다.");
    setExpandedSessionId(null);
    loadSummaries();
  }

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-3">
        <p className="eyebrow-en text-clay-400">Match History</p>
        <h1 className="headline-kr text-4xl text-line-900">매치 히스토리</h1>
      </header>

      {/* 기록 탭 */}
      <div className="mb-4 flex gap-2">
        <span className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1.5 text-xs font-semibold text-clay-400">
          매치 히스토리
        </span>
        <Link href="/matches"
          className="rounded-sm border border-line-200/40 px-3 py-1.5 text-xs font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
          경기 기록
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : summaries.length === 0 ? (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-6 text-center">
          <p className="text-sm text-line-400">완료된 매치 기록이 없어요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map(({ session, matchCount }) => (
            <div key={session.id} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

              {/* 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(session.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
                      {session.session_date}
                    </span>
                    <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${
                      session.status === "archived"
                        ? "border border-line-200/40 bg-line-100 text-line-500"
                        : "border border-clay-400/30 bg-clay-400/10 text-clay-400"
                    }`}>
                      {session.status === "archived" ? "보관됨" : "완료됨"}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {MATCH_SESSION_DAY_LABEL[session.session_day]}
                    {(session.session_day === "holiday" || session.session_day === "custom") && ` · ${session.title}`}
                  </p>
                  <div className="mt-1">
                    {matchCount > 0 ? (
                      <span className="text-xs text-line-500">{matchCount}경기 진행</span>
                    ) : (
                      <span className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
                        경기 결과 미입력
                      </span>
                    )}
                  </div>
                </div>
                <span className="ml-2 flex-shrink-0 text-xs text-line-400">
                  {expandedSessionId === session.id ? "▲" : "▼"}
                </span>
              </button>

              {/* 상세 */}
              {expandedSessionId === session.id && (
                <div className="border-t border-line-200/30 px-4 pb-4 pt-3">
                  {isAdmin && session.status === "archived" && (
                    <button type="button" disabled={restoringSessionId === session.id}
                      onClick={() => handleRestoreSession(session.id)}
                      className="mb-3 w-full rounded-sm border border-clay-400/60 py-2 text-xs font-semibold text-clay-400 disabled:opacity-40">
                      {restoringSessionId === session.id ? "처리 중..." : "복원 (출석 수정 가능 상태로)"}
                    </button>
                  )}

                  {loadingDetail ? (
                    <p className="text-center text-sm text-line-400">불러오는 중...</p>
                  ) : playerRecords.length === 0 ? (
                    <div className="rounded-sm border border-line-200/40 bg-line-50 p-4 text-center">
                      <p className="text-[10px] font-semibold text-line-500">경기 결과 미입력</p>
                      <p className="mt-1 text-xs text-line-400">
                        경기 결과가 입력되면 참석자별 기록이 표시됩니다.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold text-line-500">참석자별 기록</p>
                      <div className="space-y-2">
                        {playerRecords.map((r, idx) => (
                          <div key={`${r.displayName}-${r.isGuest ? "guest" : "member"}-${idx}`}
                            className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-semibold leading-snug text-line-900">
                                {r.displayName}
                              </span>
                              <MemberTypeBadge isGuest={r.isGuest} memberType={r.memberType} />
                            </div>
                            <p className="text-right">
                              <span className="font-score text-[11px] tabular-nums text-line-500">{r.games}</span>
                              <span className="text-[11px] text-line-400">경기 · </span>
                              <span className="font-score text-[11px] tabular-nums text-gold">{r.wins}</span>
                              <span className="text-[11px] text-line-500">승 </span>
                              <span className="font-score text-[11px] tabular-nums text-line-400">{r.losses}</span>
                              <span className="text-[11px] text-line-400">패 · </span>
                              <span className="font-score text-[11px] tabular-nums text-line-500">{r.winRate}%</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
