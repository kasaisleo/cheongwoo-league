"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { pct, fmtPct } from "@/lib/records/dashboardUtils";
import {
  judgeAttendanceStatus,
  ATTENDANCE_STATUS_STYLE,
  type AttendanceCheckStatus,
} from "@/lib/records/attendanceStatus";

// ── 선수별 출석 상태 ──────────────────────────────────────────────
type PlayerAttendStatus = "출석" | "미정" | "불참" | "미응답" | "출석 후 미참여";

const PLAYER_ATTEND_STYLE: Record<PlayerAttendStatus, CSSProperties> = {
  "출석":         { color: "var(--admin-achievement)" },
  "출석 후 미참여": { color: "#d4783c" },
  "미정":         { color: "var(--admin-muted)", opacity: 0.8 },
  "불참":         { color: "var(--admin-muted)", opacity: 0.65 },
  "미응답":       { color: "var(--admin-muted)", opacity: 0.45 },
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
  checkRate: number | null;
  checkStatus: AttendanceCheckStatus;
}

// ── 필터 타입 ─────────────────────────────────────────────────────
const STATUS_FILTERS: (AttendanceCheckStatus | "전체")[] = [
  "전체", "확인 필요", "응답 부족", "완료 전", "체크 양호",
];

// ── 메인 ──────────────────────────────────────────────────────────
export default function AttendanceRecordsPageClient({ currentClubId }: { currentClubId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [summaries, setSummaries] = useState<SessionAttendSummary[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<AttendanceCheckStatus | "전체">("전체");

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
        supabase.from("attendance_sessions").select("*").eq("club_id", currentClubId).neq("status", "archived").order("session_date", { ascending: false }),
        supabase.from("attendance").select("session_id, member_id, status"),
        supabase.from("matches").select("id, session_id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member").eq("club_id", currentClubId),
        supabase.from("members").select("id, name").eq("is_active", true).eq("club_id", currentClubId).order("name"),
      ]);

      const memberCount = (members ?? []).length;
      setTotalMembers(memberCount);
      setAllMembersCache(members ?? []);

      const attendBySid = new Map<string, Map<string, string>>();
      for (const row of allAttendance ?? []) {
        if (!row.session_id) continue;
        if (!attendBySid.has(row.session_id)) attendBySid.set(row.session_id, new Map());
        attendBySid.get(row.session_id)!.set(row.member_id, row.status);
      }

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
  }, [supabase, currentClubId]);

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

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="출석 체크 검수"
        description="출석 응답 현황을 검수합니다."
        backHref="/admin/records"
      />

      {/* ── 상태 필터 */}
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

      {loading ? (
        <p className="text-center text-sm" style={{ color: "var(--admin-muted)" }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--admin-card-radius,14px)] border p-6 text-center" style={cardStyle}>
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>해당 상태의 매치가 없어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>

              {/* ── 카드 헤더 */}
              <button type="button" onClick={() => toggleExpand(s.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-score text-[10px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>
                      {s.session_date}
                    </span>
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${ATTENDANCE_STATUS_STYLE[s.checkStatus]}`}>
                      {s.checkStatus}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>
                    {sessionTitle(s.session_day, s.title)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span style={{ color: "var(--admin-achievement)" }}>출석 {s.attendingCount}</span>
                    <span style={{ color: "var(--admin-muted)", opacity: 0.8 }}>미정 {s.undecidedCount}</span>
                    <span style={{ color: "var(--admin-muted)", opacity: 0.65 }}>불참 {s.absentCount}</span>
                    <span style={{ color: "var(--admin-muted)", opacity: 0.45 }}>미응답 {s.noResponseCount}</span>
                    {s.noShowCount > 0 && (
                      <span style={{ color: "#d4783c" }}>출석 후 미참여 {s.noShowCount}명</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="font-score text-xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>
                    {fmtPct(s.checkRate)}
                  </span>
                  <span className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                    체크율
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                    {expandedId === s.id ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* ── 출석 현황 바 */}
              {s.respondedCount > 0 && (
                <div className="border-t px-4 py-1.5" style={{ borderColor: "var(--admin-border)" }}>
                  <div className="flex h-1.5 overflow-hidden rounded-sm" style={{ background: "var(--admin-border)" }}>
                    {s.attendingCount > 0 && (
                      <div style={{ width: `${pct(s.attendingCount, totalMembers) ?? 0}%`, background: "var(--admin-achievement)", opacity: 0.6 }} />
                    )}
                    {s.undecidedCount > 0 && (
                      <div style={{ width: `${pct(s.undecidedCount, totalMembers) ?? 0}%`, background: "var(--admin-muted)", opacity: 0.3 }} />
                    )}
                    {s.absentCount > 0 && (
                      <div style={{ width: `${pct(s.absentCount, totalMembers) ?? 0}%`, background: "var(--admin-muted)", opacity: 0.2 }} />
                    )}
                  </div>
                  <p className="mt-1 text-[9px]" style={{ color: "var(--admin-muted)" }}>
                    응답 {s.respondedCount}/{totalMembers}명 · 미응답 {s.noResponseCount}명
                  </p>
                </div>
              )}

              {/* ── 펼침: 선수별 출석 상태 */}
              {expandedId === s.id && (
                <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--admin-border)" }}>
                  {loadingDetail ? (
                    <p className="py-2 text-center text-sm" style={{ color: "var(--admin-muted)" }}>불러오는 중...</p>
                  ) : (
                    <>
                      <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                        선수별 출석 상태 ({memberRows.length}명)
                      </p>
                      <div className="space-y-0.5">
                        {memberRows.map((r) => (
                          <div key={r.memberId} className="flex items-center justify-between py-1">
                            <span className="text-[14px] font-semibold" style={{ color: "var(--admin-text)" }}>{r.name}</span>
                            <span className="text-[11px] font-semibold" style={PLAYER_ATTEND_STYLE[r.status]}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--admin-border)" }}>
                        <Link href="/admin/attendance"
                          className="text-[10px] font-semibold transition-colors hover:text-[color:var(--admin-text)]"
                          style={{ color: "var(--admin-muted)" }}>
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
