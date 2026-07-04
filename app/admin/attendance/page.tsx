"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/Toast";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import { SessionGuestSection } from "@/components/attendance/SessionGuestSection";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import type { AttendanceStatus, AttendanceSession, Member } from "@/lib/supabase/database.types";
import TennisBallLoader from "@/components/common/TennisBallLoader";

import { DEFAULT_CLUB_ID } from "@/lib/current-club";

const CHEONGWOO_CLUB_ID = DEFAULT_CLUB_ID;

/**
 * /admin/attendance — 운영진 전용 출석 관리 페이지.
 *
 * Phase 2 이관: /attendance의 관리자 기능을 여기로 이동.
 *   - 매치 생성 (주간/커스텀)
 *   - 매치 완료 (closed)
 *   - 출석 수정 (완료된 매치 강제 수정)
 *   - 출석 현황 토글
 *
 * /attendance (회원용)는 이제 출석 신청 + 현황 조회만 담당한다.
 */

const MIN_REQUIRED_PLAYERS = 4;

const SESSION_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  saturday: { label: "정기", cls: "border-clay-400/40 bg-clay-400/10 text-clay-400" },
  sunday:   { label: "정기", cls: "border-clay-400/40 bg-clay-400/10 text-clay-400" },
  holiday:  { label: "휴일", cls: "border-gold/40 bg-gold/10 text-gold" },
  custom:   { label: "이벤트", cls: "border-line-300/40 bg-line-100 text-line-500" },
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MemberAttendance {
  member: Member;
  status: AttendanceStatus;
  attendanceId: string | null;
}

function AdminAttendanceInner() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("session_id");
  const supabase = useMemo(() => createClient(), []);

  // 권한 체크는 layout.tsx의 requireAdminAccess()가 서버에서 처리.
  // 이 컴포넌트까지 도달했으면 이미 관리자 확인 완료.

  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberAttendance[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [processingOverlay, setProcessingOverlay] = useState<{ label: string; description: string } | null>(null);
  const [editingClosedSession, setEditingClosedSession] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");

  
  // 매치(출석 세션) 목록 로드
  useEffect(() => {
    let isCurrent = true;
    async function loadSessions() {
      setLoadingSessions(true);
      const sessions = await fetchActiveSessions(supabase);
      if (!isCurrent) return;
      setOpenSessions(sessions);
      setSelectedSessionId((prev) => {
        if (prev) return prev;
        const fromUrl = initialSessionId && sessions.some((s) => s.id === initialSessionId)
          ? initialSessionId : null;
        return fromUrl ?? sessions[0]?.id ?? null;
      });
      setLoadingSessions(false);
    }
    loadSessions();
    return () => { isCurrent = false; };
  }, [supabase, initialSessionId]);

  // 선택 세션의 명단 로드
  useEffect(() => {
    setEditingClosedSession(false);
    setMemberQuery("");
    setStatusFilter("all");
    if (!selectedSessionId) { setRows([]); return; }

    let isCurrent = true;
    setLoadingRows(true);

    async function loadRows() {
      const [{ data: members }, { data: attendance }] = await Promise.all([
        supabase.from("members").select("*").eq("is_active", true).eq("is_dormant", false).eq("club_id", CHEONGWOO_CLUB_ID).order("nickname"),
        supabase.from("attendance").select("*").eq("session_id", selectedSessionId),
      ]);
      if (!isCurrent) return;
      const attendanceByMember = new Map((attendance ?? []).map((a) => [a.member_id, a]));
      setRows((members ?? []).map((member) => {
        const existing = attendanceByMember.get(member.id);
        return { member, status: existing?.status ?? "undecided", attendanceId: existing?.id ?? null };
      }));
      setLoadingRows(false);
    }
    loadRows();
    return () => { isCurrent = false; };
  }, [selectedSessionId, supabase]);

  // 출석 상태 변경 (운영진 전용 — closed 세션 포함)
  const updateStatus = useCallback(async (memberId: string, newStatus: AttendanceStatus) => {
    if (!selectedSessionId || !selectedSession) {
      toast.error("매치를 선택해주세요.");
      return;
    }
    if (selectedSession.status === "archived") {
      toast.error("보관된 매치는 읽기 전용입니다.");
      return;
    }
    const previousStatus = rows.find((r) => r.member.id === memberId)?.status ?? "undecided";
    setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, status: newStatus } : row));
    setUpdatingMemberId(memberId);
    setPendingStatus(newStatus);

    let succeeded = false;
    let newAttendanceId: string | null = null;

    if (selectedSession.status === "closed") {
      const res = await fetch("/api/attendance/admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, sessionId: selectedSessionId, status: newStatus }),
      });
      const body = await res.json().catch(() => null);
      succeeded = res.ok;
      newAttendanceId = body?.attendance?.id ?? null;
    } else {
      const { data, error } = await supabase.from("attendance").upsert({
        member_id: memberId, session_id: selectedSessionId,
        event_date: selectedSession.session_date, status: newStatus,
        updated_at: new Date().toISOString(),
      }, { onConflict: "member_id,session_id" }).select().single();
      succeeded = !error && Boolean(data);
      newAttendanceId = data?.id ?? null;
    }

    setUpdatingMemberId(null);
    setPendingStatus(null);
    if (!succeeded) {
      setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, status: previousStatus } : row));
      toast.error("출석 변경에 실패했습니다.");
      return;
    }
    setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, attendanceId: newAttendanceId } : row));
  }, [selectedSessionId, rows, supabase]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateWeeklySessions() {
    if (!window.confirm("기존 열린 토/일 매치를 보관하고 이번 주 토/일 매치를 새로 생성합니다. 진행할까요?")) return;
    const res = await fetch("/api/attendance-sessions/weekly", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok) { toast.error(body?.error ?? "매치 생성에 실패했습니다."); return; }
    toast.success("이번 주 매치가 생성되었습니다.");
    window.location.reload();
  }

  async function handleSessionStatusChange(sessionId: string, targetStatus: "closed" | "archived", closeMenu?: () => void) {
    closeMenu?.();

    // 완료 처리 시 경기 기록 / 출석 후 미참여 사전 검수
    if (targetStatus === "closed") {
      const supabase = createClient();
      const [{ data: matchData }, { data: attendData }] = await Promise.all([
        supabase.from("matches").select("id, team_a_player1_member, team_a_player2_member, team_b_player1_member, team_b_player2_member").eq("session_id", sessionId),
        supabase.from("attendance").select("member_id, status").eq("session_id", sessionId),
      ]);

      const warnings: string[] = [];

      if ((matchData ?? []).length === 0) {
        warnings.push("경기 기록이 없어요.");
      }

      const participantIds = new Set<string>();
      for (const m of matchData ?? []) {
        [m.team_a_player1_member, m.team_a_player2_member, m.team_b_player1_member, m.team_b_player2_member]
          .filter(Boolean).forEach((id) => participantIds.add(id!));
      }
      const attendingIds = (attendData ?? []).filter((r) => r.status === "attending").map((r) => r.member_id);
      const noShowIds = attendingIds.filter((mid) => !participantIds.has(mid));
      if (noShowIds.length > 0) {
        warnings.push(`출석 체크 후 경기 기록이 없는 선수가 ${noShowIds.length}명 있어요.`);
      }

      if (warnings.length > 0) {
        const proceed = window.confirm(
          `⚠️ 완료 전 확인\n\n${warnings.join("\n")}\n\n그래도 완료 처리하시겠습니까?`
        );
        if (!proceed) return;
      } else {
        if (!window.confirm("이 매치를 완료 처리할까요?")) return;
      }
    } else {
      if (!window.confirm("이 매치를 보관 처리할까요?")) return;
    }

    // confirm 확인 후 실제 API 호출 시작 — 이때 overlay ON
    setProcessingSessionId(sessionId);
    setProcessingOverlay(
      targetStatus === "closed"
        ? { label: "완료 처리 중", description: "경기 기록과 출석 상태를 확인하고 있어요." }
        : { label: "보관 처리 중", description: "매치를 보관하고 있어요." }
    );
    try {
      const res = await fetch("/api/attendance-sessions/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, targetStatus }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? (targetStatus === "closed" ? "매치 완료 처리 실패" : "보관 처리 실패"));
        return;
      }
      toast.success(targetStatus === "closed" ? "매치가 완료 처리되었습니다." : "매치가 보관되었습니다.");
      window.location.reload();
    } finally {
      setProcessingSessionId(null);
      setProcessingOverlay(null);  // 성공/실패 무관하게 반드시 해제
    }
  }

  const attending = rows.filter((r) => r.status === "attending").length;
  const undecided = rows.filter((r) => r.status === "undecided").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);
  const selectedSession = openSessions.find((s) => s.id === selectedSessionId) ?? null;
  const selectedSessionIsCustom = selectedSession?.session_day === "holiday" || selectedSession?.session_day === "custom";

  const filteredRows = rows.filter((row) => {
    const label = getDisambiguatedName(row.member, rows.map((r) => r.member));
    const matchesQuery = !memberQuery.trim() || label.toLowerCase().includes(memberQuery.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    return matchesQuery && matchesStatus;
  });



  return (
    <main className="px-4 pt-6 pb-28">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Attendance</p>
          <h1 className="headline-kr text-4xl text-line-900">출석 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
            ← 관리자
          </Link>
        </div>
      </header>

      {/* ── 매치 선택 드롭다운 ───────────────────────── */}
      {loadingSessions ? (
        <p className="text-center text-sm text-line-400">매치를 불러오는 중...</p>
      ) : openSessions.length === 0 ? (
        <div className="mb-4 rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-line-500">No Matches</p>
          <p className="mt-1 text-xs text-line-400">⚙ 메뉴에서 매치를 먼저 생성해주세요.</p>
        </div>
      ) : (
        <div className="mb-4">
          <Dropdown
            align="left"
            triggerClassName="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-50 px-3 py-2.5"
            trigger={
              <>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-line-900">
                    {selectedSession
                      ? `${selectedSession.title} · ${selectedSession.session_date}`
                      : "매치 선택"}
                  </span>
                  {selectedSession && SESSION_TYPE_BADGE[selectedSession.session_day] && (
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${SESSION_TYPE_BADGE[selectedSession.session_day].cls}`}>
                      {SESSION_TYPE_BADGE[selectedSession.session_day].label}
                    </span>
                  )}
                </span>
                <span className="text-xs text-line-500">▼</span>
              </>
            }
          >
            {(close) => (
              <div className="max-h-64 overflow-y-auto">
                {openSessions.map((session) => {
                  const badge = SESSION_TYPE_BADGE[session.session_day];
                  return (
                    <DropdownItem key={session.id} onClick={() => { setSelectedSessionId(session.id); close(); }}>
                      <div className="flex items-center gap-2">
                        <span className={selectedSessionId === session.id ? "text-clay-400" : ""}>
                          {session.title} · {session.session_date}
                        </span>
                        {badge && (
                          <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </DropdownItem>
                  );
                })}
              </div>
            )}
          </Dropdown>
        </div>
      )}



      {selectedSession && (
        <>
          {/* ── 통계 + 완료/수정 버튼 ─────────────────── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                출석 현황
                {selectedSession.status === "closed" && (
                  <span className={`ml-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${
                    editingClosedSession ? "bg-clay-400/10 text-clay-400" : "bg-line-200 text-line-500"
                  }`}>
                    {editingClosedSession ? "수정 중" : "완료됨"}
                  </span>
                )}
              </p>
              {/* 매치 완료/수정 버튼 */}
              <div className="flex gap-1.5">
                {selectedSession.status === "open" && (
                  <Link href={`/matches/new?sessionId=${selectedSessionId}`}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 hover:text-line-700">
                    결과 입력
                  </Link>
                )}
                {selectedSession.status === "open" && (
                  <button type="button"
                    disabled={processingSessionId === selectedSessionId}
                    onClick={() => handleSessionStatusChange(selectedSessionId!, "closed")}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 disabled:opacity-40">
                    완료 처리
                  </button>
                )}
                {selectedSession.status === "closed" && !editingClosedSession && (
                  <button type="button" onClick={() => setEditingClosedSession(true)}
                    className="rounded-sm border border-clay-400/60 px-2.5 py-1 text-[11px] font-semibold text-clay-400">
                    출석 수정
                  </button>
                )}
                {selectedSession.status === "closed" && editingClosedSession && (
                  <button type="button" onClick={() => setEditingClosedSession(false)}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500">
                    수정 완료
                  </button>
                )}
                {selectedSession.status === "closed" && (
                  <Link href={`/matches/new?sessionId=${selectedSessionId}`}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 hover:text-line-700">
                    결과 입력
                  </Link>
                )}
                {selectedSession.status === "closed" && (
                  <Link href="/admin/records/matches"
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 hover:text-line-700">
                    기록 검수
                  </Link>
                )}
              </div>
            </div>

            {/* 통계 3단 */}
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="grid grid-cols-3 divide-x divide-line-200/30">
                <button type="button" onClick={() => setStatusFilter(statusFilter === "attending" ? "all" : "attending")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "attending" ? "border-gold bg-gold/10" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-gold">{attending}</p>
                  <p className="text-[9px] font-bold tracking-wide text-line-500">출석</p>
                </button>
                <button type="button" onClick={() => setStatusFilter(statusFilter === "undecided" ? "all" : "undecided")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "undecided" ? "border-clay-400 bg-clay-400/10" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-clay-400">{undecided}</p>
                  <p className="text-[9px] font-bold tracking-wide text-line-500">미정</p>
                </button>
                <button type="button" onClick={() => setStatusFilter(statusFilter === "absent" ? "all" : "absent")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "absent" ? "border-line-300 bg-line-200" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-line-500">{absent}</p>
                  <p className="text-[9px] font-bold tracking-wide text-line-500">불참</p>
                </button>
              </div>
              {shortage > 0 && (
                <div className="border-t border-line-200/30 px-4 py-2 text-center">
                  <Badge tone="loss">{shortage}명 더 필요해요</Badge>
                </div>
              )}
              {attending >= MIN_REQUIRED_PLAYERS && (
                <div className="border-t border-line-200/30 px-4 py-2 text-center">
                  <Badge tone="clay">복식 경기 가능</Badge>
                </div>
              )}
            </div>
          </div>

          {/* ── 게스트 참석자 (통계 아래, 출석 현황 위) ─ */}
          {selectedSession.status !== "archived" && (
            <div className="mb-3">
              <SessionGuestSection
                sessionId={selectedSession.id}
                editable={true}
              />
            </div>
          )}

          {/* ── 검색 + 필터 칩 ───────────────────────── */}
          <div className="mb-3 space-y-2">
            <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="이름 검색"
              className="box-border block h-9 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-500" />
            <div className="flex gap-1.5">
              {(["all", "attending", "undecided", "absent"] as const).map((f) => {
                const LABELS: Record<string, string> = { all: "전체", attending: "출석", undecided: "미정", absent: "불참" };
                const isActive = statusFilter === f;
                return (
                  <button key={f} type="button" onClick={() => setStatusFilter(f === "all" ? "all" : f as AttendanceStatus)}
                    className={`rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      isActive
                        ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                        : "border-line-200/40 text-line-500"
                    }`}>
                    {LABELS[f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 출석 현황 ──────────────────────────────── */}
          {loadingRows ? (
            <p className="text-center text-sm text-line-400">출석 현황을 불러오는 중...</p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              {filteredRows.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">No Results</p>
                  <p className="mt-1 text-sm text-line-400">해당하는 회원이 없습니다.</p>
                </div>
              ) : filteredRows.map((row, idx) => {
                const isLast = idx === filteredRows.length - 1;
                const label = getDisambiguatedName(row.member, rows.map((r) => r.member));
                const isUpdating = updatingMemberId === row.member.id;
                const isDisabled = (selectedSession.status === "closed" && !editingClosedSession) || selectedSession.status === "archived";
                const accentColor =
                  row.status === "attending" ? "border-l-gold"
                  : row.status === "absent"   ? "border-l-line-300"
                  : "border-l-clay-400";
                return (
                  <div key={row.member.id}
                    className={`flex items-center gap-3 border-l-4 ${accentColor} px-4 py-3 ${isLast ? "" : "border-b border-line-200/30"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug truncate text-line-900">{label}</p>
                      {row.member.role && (
                        <span className="rounded-sm bg-line-200 px-1.5 py-0.5 text-[9px] font-semibold text-line-600">
                          {row.member.role}
                        </span>
                      )}
                    </div>
                    <AttendanceToggle
                      value={row.status}
                      onChange={(s) => updateStatus(row.member.id, s)}
                      pendingStatus={isUpdating ? pendingStatus : null}
                      disabled={isDisabled}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── 세션 완료/보관 처리 중 오버레이 (confirm 이후에만 표시) */}
      {processingOverlay && (
        <TennisBallLoader
          variant="overlay"
          mode="admin"
          label={processingOverlay.label}
          description={processingOverlay.description}
        />
      )}
    </main>
  );
}

export default function AdminAttendancePage() {
  return (
    <Suspense fallback={null}>
      <AdminAttendanceInner />
    </Suspense>
  );
}
