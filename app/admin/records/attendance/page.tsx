"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { pct, fmtPct } from "@/lib/records/dashboardUtils";
import {
  judgeAttendanceStatus,
  ATTENDANCE_STATUS_STYLE,
  type AttendanceCheckStatus,
} from "@/lib/records/attendanceStatus";

import { DEFAULT_CLUB_ID } from "@/lib/club-constants";

const CHEONGWOO_CLUB_ID = DEFAULT_CLUB_ID;

// ── 선수별 출석 상태 ──────────────────────────────────────────────
type PlayerAttendStatus = "출석" | "미정" | "불참" | "미응답" | "출석 후 미참여";

const PLAYER_ATTEND_STYLE: Record<PlayerAttendStatus, string> = {
  "출석":         "text-gold",
  "출석 후 미참여": "text-clay-400",
  "미정":         "text-line-500",
  "불참":         "text-line-400",
  "미응답":       "text-line-300",
};

interface MemberRow {
  memberId: string;
  name: string;
  status: PlayerAttendStatus;
}

// ── 세션 요약 타입 ─────────────────────────────────────────────────
interface SessionAttendSummary {
  id: string;
  title: string;
  session_date: string;
  session_day: string;
  isCompleted: boolean;
  attendingCount: number;
  undecidedCount: number;
  absentCount: number;
  noResponseCount: number;
  noShowCount: number;
  respondedCount: number;
  checkRate: number | null;   // 응답률 (responded / totalMembers)
  checkStatus: AttendanceCheckStatus;
}

// ── 필터 타입 ─────────────────────────────────────────────────────
const STATUS_FILTERS: (AttendanceCheckStatus | "전체")[] = [
  "전체", "확인 필요", "응답 부족", "완료 전", "체크 양호",
];

// ── 메인 ──────────────────────────────────────────────────────────
export default function RecordsAttendancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [summaries, setSummaries] = useState<SessionAttendSummary[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<AttendanceCheckStatus | "전체">("전체");

  // 세션별 경기 참여자 캐시
  const [participantsBySid, setParticipantsBySid] = useState<Map<string, Set<string>>>(new Map());
  const [allMembersCache, setAllMembersCache] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      const [
        { data: sessions },
        { data: allAttendance },
        { data: allMatches },
        { data: members },
      ] = await Promise.all([
        supabase.from("attendance_sessions").select("*").eq("club_id", CHEONGWOO_CLUB_ID).neq("status", "archived").order("session_date", { ascending: false }),
        supabase.from("attendance").select("session_id, member_id, status"),
        supabase.from("matches").select("id, session_id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member").eq("club_id", CHEONGWOO_CLUB_ID),
        supabase.from("members").select("id, name").eq("is_active", true).eq("club_id", CHEONGWOO_CLUB_ID).order("name"),
      ]);

      const memberCount = (members ?? []).length;
      setTotalMembers(memberCount);
      setAllMembersCache(members ?? []);

      // session별 attendance 집계
      const attendBySid = new Map<string, Map<string, string>>();
      for (const row of allAttendance ?? []) {
        if (!row.session_id) continue;
        if (!attendBySid.has(row.session_id)) attendBySid.set(row.session_id, new Map());
        attendBySid.get(row.session_id)!.set(row.member_id, row.status);
      }

      // session별 경기 참여자
      const ptsBySid = new Map<string, Set<string>>();
      for (const m of allMatches ?? []) {
        if (!m.session_id) continue;
        if (!ptsBySid.has(m.session_id)) ptsBySid.set(m.session_id, new Set());
        const s = ptsBySid.get(m.session_id)!;
        [m.team_a_player1_member, m.team_a_player2_member,
         m.team_b_player1_member, m.team_b_player2_member]
          .filter(Boolean).forEach((id) => s.add(id!));
      }
      setParticipantsBySid(ptsBySid);

      const result: SessionAttendSummary[] = (sessions ?? []).map((session) => {
        const isCompleted = session.status === "closed" || session.session_date < today;
        const statusMap = attendBySid.get(session.id) ?? new Map<string, string>();

        let attendingCount = 0, undecidedCount = 0, absentCount = 0;
        for (const st of statusMap.values()) {
          if (st === "attending") attendingCount++;
          else if (st === "undecided") undecidedCount++;
          else if (st === "absent") absentCount++;
        }
        const respondedCount = attendingCount + undecidedCount + absentCount;
        const noResponseCount = Math.max(0, memberCount - respondedCount);

        // 출석 후 미참여
        const participants = ptsBySid.get(session.id) ?? new Set<string>();
        let noShowCount = 0;
        for (const [mid, st] of statusMap) {
          if (st === "attending" && !participants.has(mid)) noShowCount++;
        }

        const checkRate = pct(respondedCount, memberCount);
        const checkStatus = judgeAttendanceStatus({
          isCompleted,
          totalMembers: memberCount,
          attendingCount,
          undecidedCount,
          absentCount,
          noResponseCount,
          noShowCount,
        });

        return {
          id: session.id,
          title: session.title,
          session_date: session.session_date,
          session_day: session.session_day,
          isCompleted,
          attendingCount,
          undecidedCount,
          absentCount,
          noResponseCount,
          noShowCount,
          respondedCount,
          checkRate,
          checkStatus,
        };
      });

      setSummaries(result);
      setLoading(false);
    }
    load();
  }, [supabase]);

  // 선수별 출석 상태 펼침
  async function toggleExpand(sid: string) {
    if (expandedId === sid) { setExpandedId(null); setMemberRows([]); return; }
    setExpandedId(sid);
    setLoadingDetail(true);

    const { data: rows } = await supabase
      .from("attendance").select("member_id, status").eq("session_id", sid);

    const statusMap = new Map((rows ?? []).map((r) => [r.member_id, r.status]));
    const participants = participantsBySid.get(sid) ?? new Set<string>();

    const memberRowList: MemberRow[] = allMembersCache.map((m) => {
      const st = statusMap.get(m.id);
      let status: PlayerAttendStatus;
      if (st === "attending") {
        status = participants.has(m.id) ? "출석" : "출석 후 미참여";
      } else if (st === "undecided") {
        status = "미정";
      } else if (st === "absent") {
        status = "불참";
      } else {
        status = "미응답";
      }
      return { memberId: m.id, name: m.name, status };
    });

    // 정렬: 출석 후 미참여 → 출석 → 미정 → 불참 → 미응답
    const ORDER: Record<PlayerAttendStatus, number> = {
      "출석 후 미참여": 0,
      "출석": 1,
      "미정": 2,
      "불참": 3,
      "미응답": 4,
    };
    memberRowList.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, "ko"));

    setMemberRows(memberRowList);
    setLoadingDetail(false);
  }

  function sessionTitle(session_day: string, title: string) {
    const base = MATCH_SESSION_DAY_LABEL[session_day as keyof typeof MATCH_SESSION_DAY_LABEL] ?? title;
    return (session_day === "holiday" || session_day === "custom") ? `${base} · ${title}` : base;
  }

  const filtered = filterStatus === "전체"
    ? summaries
    : summaries.filter((s) => s.checkStatus === filterStatus);

  return (
    <main className="px-4 pt-6 pb-28">

      {/* ── 헤더 */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Records</p>
          <h1 className="headline-kr text-4xl text-line-900">출석 체크 검수</h1>
          <p className="mt-1 max-w-[280px] break-keep text-xs leading-relaxed text-line-500">출석 응답 현황을 검수합니다.</p>
        </div>
        <Link href="/admin/records"
          className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 기록 대시보드
        </Link>
      </header>

      {/* ── 상태 필터 */}
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
            <div key={s.id} className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

              {/* ── 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(s.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-line-100/40">
                <div className="min-w-0 flex-1">
                  {/* 날짜 + 상태 배지 */}
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums text-line-400">
                      {s.session_date}
                    </span>
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${ATTENDANCE_STATUS_STYLE[s.checkStatus]}`}>
                      {s.checkStatus}
                    </span>
                  </div>
                  {/* 매치명 */}
                  <p className="text-[15px] font-semibold leading-snug text-line-900">
                    {sessionTitle(s.session_day, s.title)}
                  </p>
                  {/* 요약 수치 */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span className="text-gold">출석 {s.attendingCount}</span>
                    <span className="text-line-500">미정 {s.undecidedCount}</span>
                    <span className="text-line-400">불참 {s.absentCount}</span>
                    <span className="text-line-300">미응답 {s.noResponseCount}</span>
                    {s.noShowCount > 0 && (
                      <span className="text-clay-400">출석 후 미참여 {s.noShowCount}명</span>
                    )}
                  </div>
                </div>
                {/* 출석 체크율 */}
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="font-score text-xl font-bold tabular-nums text-line-900">
                    {fmtPct(s.checkRate)}
                  </span>
                  <span className="font-display text-[9px] font-bold uppercase tracking-widest text-line-400">
                    체크율
                  </span>
                  <span className="text-[10px] text-line-400">
                    {expandedId === s.id ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* ── 출석 현황 바 */}
              {s.respondedCount > 0 && (
                <div className="border-t border-line-200/30 px-4 py-1.5">
                  {/* 시각 바 */}
                  <div className="flex h-1.5 overflow-hidden rounded-sm bg-line-200/40">
                    {s.attendingCount > 0 && (
                      <div className="bg-gold/60" style={{ width: `${pct(s.attendingCount, totalMembers) ?? 0}%` }} />
                    )}
                    {s.undecidedCount > 0 && (
                      <div className="bg-line-400/40" style={{ width: `${pct(s.undecidedCount, totalMembers) ?? 0}%` }} />
                    )}
                    {s.absentCount > 0 && (
                      <div className="bg-line-300/40" style={{ width: `${pct(s.absentCount, totalMembers) ?? 0}%` }} />
                    )}
                  </div>
                  <p className="mt-1 text-[9px] text-line-400">
                    응답 {s.respondedCount}/{totalMembers}명 · 미응답 {s.noResponseCount}명
                  </p>
                </div>
              )}

              {/* ── 펼침: 선수별 출석 상태 */}
              {expandedId === s.id && (
                <div className="border-t border-line-200/30 px-4 pb-3 pt-2">
                  {loadingDetail ? (
                    <p className="py-2 text-center text-sm text-line-400">불러오는 중...</p>
                  ) : (
                    <>
                      <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                        선수별 출석 상태 ({memberRows.length}명)
                      </p>
                      <div className="space-y-0.5">
                        {memberRows.map((r) => (
                          <div key={r.memberId} className="flex items-center justify-between py-1">
                            <span className="text-[14px] font-semibold text-line-900">{r.name}</span>
                            <span className={`text-[11px] font-semibold ${PLAYER_ATTEND_STYLE[r.status]}`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t border-line-200/20 pt-2">
                        <Link href="/admin/attendance"
                          className="text-[10px] font-semibold text-line-500 hover:text-clay-400">
                          출석 관리 →
                        </Link>
                      </div>
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
