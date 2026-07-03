"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { judgeMatchStatus, type MatchStatus } from "@/lib/records/matchStatus";
import { pct, fmtPct } from "@/lib/records/dashboardUtils";
import type { AttendanceStatus } from "@/lib/supabase/database.types";


const STATUS_STYLE: Record<MatchStatus, string> = {
  "정상":    "border-gold/40 bg-gold/10 text-gold",
  "확인 필요": "border-clay-400/40 bg-clay-400/10 text-clay-400",
  "기록 부족": "border-line-200/40 bg-line-200/40 text-line-500",
  "완료 전":  "border-line-200/40 bg-line-50 text-line-400",
};

// ── 선수별 상태 ───────────────────────────────────────────────────
type PlayerStatus = "경기 참여" | "미참여" | "미출석" | "출석 후 미참여";

interface PlayerStatusRow {
  memberId: string;
  name: string;
  status: PlayerStatus;
}

// ── 세션 요약 타입 ────────────────────────────────────────────────
interface SessionSummary {
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
  noResponseCount: number;    // 완료 매치 총 회원 - 응답자 수 (미출석)
  gameParticipantIds: Set<string>;  // 경기 기록 등장 멤버
  gameParticipantCount: number;
  noShowCount: number;        // 출석했지만 경기 기록 없는 인원
  noShowMembers: string[];    // 해당 멤버 ID 목록
  matchStatus: MatchStatus;
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function RecordsMatchesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playerRows, setPlayerRows] = useState<PlayerStatusRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<MatchStatus | "전체">("전체");
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [totalMembersCount, setTotalMembersCount] = useState(0);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      const [
        { data: sessions },
        { data: allMatches },
        { data: allAttendance },
        { data: members },
      ] = await Promise.all([
        supabase.from("attendance_sessions").select("*").neq("status", "archived").order("session_date", { ascending: false }),
        supabase.from("matches").select("id, session_id, winner_team, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member"),
        supabase.from("attendance").select("session_id, member_id, status"),
        supabase.from("members").select("id, name").eq("is_active", true),
      ]);

      const nameMap = new Map((members ?? []).map((m) => [m.id, m.name]));
      setMemberNames(nameMap);

      const totalMembers = (members ?? []).length;

      // session별 attendance 맵
      const attendBySession = new Map<string, { member_id: string; status: AttendanceStatus }[]>();
      for (const row of allAttendance ?? []) {
        if (!row.session_id) continue;
        if (!attendBySession.has(row.session_id)) attendBySession.set(row.session_id, []);
        attendBySession.get(row.session_id)!.push({ member_id: row.member_id, status: row.status as AttendanceStatus });
      }

      // session별 경기 참여자 맵
      const participantsBySession = new Map<string, Set<string>>();
      for (const m of allMatches ?? []) {
        if (!m.session_id) continue;
        if (!participantsBySession.has(m.session_id)) participantsBySession.set(m.session_id, new Set());
        const s = participantsBySession.get(m.session_id)!;
        [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
          .filter(Boolean).forEach((id) => s.add(id!));
      }

      // session별 경기 수
      const gameCountBySession = new Map<string, number>();
      for (const m of allMatches ?? []) {
        if (!m.session_id) continue;
        gameCountBySession.set(m.session_id, (gameCountBySession.get(m.session_id) ?? 0) + 1);
      }

      const result: SessionSummary[] = (sessions ?? []).map((session) => {
        const isCompleted = session.status === "closed" || session.session_date < today;
        const attendRows = attendBySession.get(session.id) ?? [];
        const attendingCount  = attendRows.filter((r) => r.status === "attending").length;
        const absentCount     = attendRows.filter((r) => r.status === "absent").length;
        const undecidedCount  = attendRows.filter((r) => r.status === "undecided").length;
        const respondedCount  = attendingCount + absentCount + undecidedCount;
        const noResponseCount = isCompleted ? Math.max(0, totalMembers - respondedCount) : 0;

        const participants = participantsBySession.get(session.id) ?? new Set<string>();
        const gameCount = gameCountBySession.get(session.id) ?? 0;

        // 출석 후 미참여: attending이지만 경기 슬롯에 없는 인원
        const noShowMembers = attendRows
          .filter((r) => r.status === "attending" && !participants.has(r.member_id))
          .map((r) => r.member_id);

        const summary: SessionSummary = {
          session: { id: session.id, title: session.title, session_date: session.session_date, session_day: session.session_day, status: session.status },
          isCompleted,
          gameCount,
          attendingCount,
          absentCount,
          undecidedCount,
          noResponseCount,
          gameParticipantIds: participants,
          gameParticipantCount: participants.size,
          noShowCount: noShowMembers.length,
          noShowMembers,
          matchStatus: judgeMatchStatus({ isCompleted, gameCount, attendingCount, gameParticipantCount: participants.size, noShowCount: noShowMembers.length }),
        };
        return summary;
      });

      setSummaries(result);
      setLoading(false);
    }
    load();
  }, [supabase]);

  // 상세 펼칠 때 선수별 상태 계산
  async function toggleExpand(sid: string, summary: SessionSummary) {
    if (expandedId === sid) { setExpandedId(null); setPlayerRows([]); return; }
    setExpandedId(sid);
    setLoadingDetail(true);

    // 해당 세션 attendance 재조회
    const { data: attendRows } = await supabase
      .from("attendance").select("member_id, status").eq("session_id", sid);
    const { data: sessionMembers } = await supabase
      .from("members").select("id, name").eq("is_active", true);

    const respondedMap = new Map((attendRows ?? []).map((r) => [r.member_id, r.status as AttendanceStatus]));
    const allMembers = sessionMembers ?? [];

    const rows: PlayerStatusRow[] = allMembers.map((m) => {
      const attendStatus = respondedMap.get(m.id);
      const inGame = summary.gameParticipantIds.has(m.id);
      let status: PlayerStatus;

      if (inGame) {
        status = "경기 참여";
      } else if (attendStatus === "attending") {
        status = "출석 후 미참여";
      } else if (attendStatus === "absent" || attendStatus === "undecided") {
        status = "미참여";
      } else {
        // 응답 없음
        status = summary.isCompleted ? "미출석" : "미참여";
      }
      return { memberId: m.id, name: m.name, status };
    });

    // 경기 참여 → 출석 후 미참여 → 미참여 → 미출석 순
    const ORDER: Record<PlayerStatus, number> = { "경기 참여": 0, "출석 후 미참여": 1, "미참여": 2, "미출석": 3 };
    rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, "ko"));

    setPlayerRows(rows);
    setLoadingDetail(false);
  }

  function sessionTitle(s: SessionSummary["session"]) {
    const base = MATCH_SESSION_DAY_LABEL[s.session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? s.title;
    return (s.session_day === "holiday" || s.session_day === "custom") ? `${base} · ${s.title}` : base;
  }

  const PLAYER_STATUS_STYLE: Record<PlayerStatus, string> = {
    "경기 참여":    "text-gold",
    "출석 후 미참여": "text-clay-400",
    "미참여":      "text-line-400",
    "미출석":      "text-line-300",
  };

  const STATUS_FILTERS: (MatchStatus | "전체")[] = ["전체", "확인 필요", "기록 부족", "완료 전", "정상"];

  const filtered = filterStatus === "전체" ? summaries : summaries.filter((s) => s.matchStatus === filterStatus);

  return (
    <main className="px-4 pt-6 pb-28">

      {/* 헤더 */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">경기 검수</h1>
          <p className="mt-1 max-w-[280px] break-keep text-xs leading-relaxed text-line-500">경기 기록 누락과 이상을 검수합니다.</p>
        </div>
        <Link href="/admin/records" className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 기록 대시보드
        </Link>
      </header>

      {/* 상태 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilterStatus(f)}
            className={`rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
              filterStatus === f
                ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                : "border-line-200/40 text-line-500 hover:border-line-300"
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-6 text-center">
          <p className="text-sm text-line-400">해당 상태의 매치가 없어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.session.id} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

              {/* 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(s.session.id, s)}
                className="flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-line-100/40">
                <div className="min-w-0 flex-1">
                  {/* 날짜 + 상태 배지 */}
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums text-line-400">
                      {s.session.session_date}
                    </span>
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLE[s.matchStatus]}`}>
                      {s.matchStatus}
                    </span>
                  </div>
                  {/* 매치명 */}
                  <p className="text-[15px] font-semibold leading-snug text-line-900">{sessionTitle(s.session)}</p>
                  {/* 요약 수치 */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span className="text-gold">{s.gameParticipantCount}명 경기 참여</span>
                    <span className="text-line-500">{s.gameCount}경기</span>
                    {s.noShowCount > 0 && (
                      <span className="text-clay-400">출석 후 미참여 {s.noShowCount}명</span>
                    )}
                    {s.noResponseCount > 0 && (
                      <span className="text-line-400">미출석 {s.noResponseCount}명</span>
                    )}
                    {!s.isCompleted && (
                      <span className="text-line-400">진행 중</span>
                    )}
                  </div>
                </div>
                {/* 경기 결과 입력 */}
                <div className="ml-3 flex flex-shrink-0 flex-col items-end gap-1.5">
                  {s.isCompleted && s.gameCount === 0 && (
                    <Link href={`/admin/matches/new?sessionId=${s.session.id}`}
                      className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/20"
                      onClick={(e) => e.stopPropagation()}>
                      결과 입력
                    </Link>
                  )}
                  <span className="text-[10px] text-line-400">{expandedId === s.session.id ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* 출석 통계 바 */}
              <div className="border-t border-line-200/30 px-4 py-2">
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-gold">출석 {s.attendingCount}</span>
                  <span className="text-clay-400">미정 {s.undecidedCount}</span>
                  <span className="text-line-400">불참 {s.absentCount}</span>
                  <span className="text-line-300">미응답 {s.noResponseCount}</span>
                  <span className="ml-auto text-line-500">
                    출석 체크율 {fmtPct(pct(s.attendingCount + s.absentCount + s.undecidedCount, totalMembersCount))}
                  </span>
                </div>
              </div>

              {/* 상세 — 선수별 상태 */}
              {expandedId === s.session.id && (
                <div className="border-t border-line-200/30 px-4 pb-3 pt-2">
                  {loadingDetail ? (
                    <p className="py-2 text-center text-sm text-line-400">불러오는 중...</p>
                  ) : (
                    <>
                      <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                        선수별 상태 ({playerRows.length}명)
                      </p>
                      <div className="space-y-0.5">
                        {playerRows.map((r) => (
                          <div key={r.memberId} className="flex items-center justify-between py-1">
                            <span className="text-[14px] font-semibold text-line-900">{r.name}</span>
                            <span className={`text-[11px] font-semibold ${PLAYER_STATUS_STYLE[r.status]}`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* 빠른 링크 */}
                      {s.gameCount > 0 && (
                        <div className="mt-3 border-t border-line-200/20 pt-2">
                          <Link href="/admin/matches" className="text-[10px] font-semibold text-line-500 hover:text-clay-400">
                            경기 기록 관리 →
                          </Link>
                        </div>
                      )}
                    </>
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
