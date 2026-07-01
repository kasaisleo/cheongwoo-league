"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/Toast";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import type { AttendanceStatus, AttendanceSession, Member } from "@/lib/supabase/database.types";

/**
 * /admin/attendance — 운영진 전용 출석 관리 페이지.
 *
 * Phase 2 이관: /attendance의 관리자 기능을 여기로 이동.
 *   - 세션 생성 (주간/커스텀)
 *   - 명단 확정 (closed)
 *   - 명단 보관 (archived)
 *   - 명단 수정 (closed 세션 강제 수정)
 *   - 전체 명단 출석 토글
 *
 * /attendance (회원용)는 이제 출석 신청 + 현황 조회만 담당한다.
 */

const MIN_REQUIRED_PLAYERS = 4;

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
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [editingClosedSession, setEditingClosedSession] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");

  // 커스텀 세션 생성 폼
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDate, setCustomDate] = useState(todayString());
  const [customDay, setCustomDay] = useState<"holiday" | "custom">("custom");
  const [customTitle, setCustomTitle] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  // 세션 목록 로드
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
        supabase.from("members").select("*").eq("is_active", true).eq("is_dormant", false).order("nickname"),
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
      toast.error("출석 세션을 선택해주세요.");
      return;
    }
    if (selectedSession.status === "archived") {
      toast.error("보관된 세션은 읽기 전용입니다.");
      return;
    }
    const previousStatus = rows.find((r) => r.member.id === memberId)?.status ?? "undecided";
    setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, status: newStatus } : row));
    setUpdatingMemberId(memberId);

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
    if (!succeeded) {
      setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, status: previousStatus } : row));
      toast.error("출석 변경에 실패했습니다.");
      return;
    }
    setRows((prev) => prev.map((row) => row.member.id === memberId ? { ...row, attendanceId: newAttendanceId } : row));
  }, [selectedSessionId, rows, supabase]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateWeeklySessions(closeMenu?: () => void) {
    closeMenu?.();
    if (!window.confirm("기존 열린 토/일 출석 세션을 보관하고 이번 주 토/일 세션을 새로 생성합니다. 진행할까요?")) return;
    const res = await fetch("/api/attendance-sessions/weekly", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok) { toast.error(body?.error ?? "세션 생성에 실패했습니다."); return; }
    toast.success("이번 주 출석 세션이 생성되었습니다.");
    window.location.reload();
  }

  async function handleCreateCustomSession() {
    if (!customDate) { toast.error("날짜를 선택해주세요."); return; }
    if (customDate < todayString()) { toast.error("오늘 이전 날짜는 선택할 수 없습니다."); return; }
    if (!customTitle.trim()) { toast.error("제목을 입력해주세요."); return; }
    setCreatingCustom(true);
    const res = await fetch("/api/attendance-sessions/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDate: customDate, sessionDay: customDay, title: customTitle.trim() }),
    });
    const body = await res.json().catch(() => null);
    setCreatingCustom(false);
    if (!res.ok) { toast.error(body?.error ?? "세션 생성에 실패했습니다."); return; }
    toast.success("세션이 생성되었습니다.");
    window.location.reload();
  }

  async function handleSessionStatusChange(sessionId: string, targetStatus: "closed" | "archived", closeMenu?: () => void) {
    closeMenu?.();
    const msg = targetStatus === "closed" ? "이 출석 명단을 확정하시겠습니까?" : "이 출석 명단을 보관하시겠습니까?";
    if (!window.confirm(msg)) return;
    setProcessingSessionId(sessionId);
    const res = await fetch("/api/attendance-sessions/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetStatus }),
    });
    const body = await res.json().catch(() => null);
    setProcessingSessionId(null);
    if (!res.ok) {
      toast.error(body?.error ?? (targetStatus === "closed" ? "명단 확정 실패" : "명단 보관 실패"));
      return;
    }
    toast.success(targetStatus === "closed" ? "출석 명단이 확정되었습니다." : "출석 명단이 보관되었습니다.");
    window.location.reload();
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
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Attendance</p>
          <h1 className="headline-kr text-4xl text-line-900">출석 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/attendance/history" className="flex h-10 w-10 items-center justify-center rounded-sm border border-line-200/40 bg-line-50 text-line-500" aria-label="출석 히스토리">
            <span className="text-base">🕓</span>
          </Link>
          {/* 세션 생성/관리 드롭다운 */}
          <Dropdown
            align="right"
            triggerClassName="flex h-10 w-10 items-center justify-center rounded-sm border border-line-200/40 bg-line-50 text-line-700 transition-colors hover:bg-line-200"
            trigger={<span className="text-lg">⚙</span>}
          >
            {(close) => (
              <div className="space-y-0.5">
                <DropdownItem onClick={() => handleCreateWeeklySessions(close)}>
                  이번 주 세션 생성
                </DropdownItem>
                <DropdownItem onClick={() => { setCustomDate((p) => p < todayString() ? todayString() : p); setShowCustomForm(true); close(); }}>
                  커스텀 세션 생성
                </DropdownItem>
                {selectedSession?.status === "open" && (
                  <DropdownItem onClick={() => handleSessionStatusChange(selectedSessionId!, "closed", close)}>
                    명단 확정
                  </DropdownItem>
                )}
                {selectedSession && selectedSession.status !== "archived" && (
                  <DropdownItem onClick={() => handleSessionStatusChange(selectedSessionId!, "archived", close)}>
                    명단 보관
                  </DropdownItem>
                )}
              </div>
            )}
          </Dropdown>
          <Link href="/admin" className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
            ← 관리자
          </Link>
        </div>
      </header>

      {/* ── 커스텀 세션 생성 폼 ──────────────────────── */}
      {showCustomForm && (
        <div className="mb-4 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-4">
          <p className="mb-3 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">New Session</p>
          <div className="space-y-2">
            <input type="date" value={customDate} min={todayString()} onChange={(e) => setCustomDate(e.target.value)}
              className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900" />
            <select value={customDay} onChange={(e) => setCustomDay(e.target.value as "holiday" | "custom")}
              className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900">
              <option value="holiday">휴일매치</option>
              <option value="custom">이벤트매치</option>
            </select>
            <input type="text" placeholder="세션 제목" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
              className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-500" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCustomForm(false)}
                className="flex-1 rounded-sm border border-line-200/40 py-2 text-sm font-semibold text-line-500">취소</button>
              <button type="button" disabled={creatingCustom} onClick={handleCreateCustomSession}
                className="flex-1 rounded-sm bg-clay-400 py-2 text-sm font-bold text-line-25 disabled:opacity-40">
                {creatingCustom ? "생성 중..." : "세션 생성"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 세션 선택 드롭다운 ───────────────────────── */}
      {loadingSessions ? (
        <p className="text-center text-sm text-line-400">세션을 불러오는 중...</p>
      ) : openSessions.length === 0 ? (
        <div className="mb-4 rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-line-500">No Sessions</p>
          <p className="mt-1 text-xs text-line-400">⚙ 메뉴에서 세션을 먼저 만들어주세요.</p>
        </div>
      ) : (
        <div className="mb-4">
          <Dropdown
            align="left"
            triggerClassName="flex w-full items-center justify-between rounded-sm border border-line-200/40 bg-line-50 px-3 py-2.5"
            trigger={
              <>
                <span className="text-sm font-semibold text-line-900">
                  {selectedSession
                    ? `${selectedSession.title}${selectedSessionIsCustom ? "" : ` · ${MATCH_SESSION_DAY_LABEL[selectedSession.session_day]}`} · ${selectedSession.session_date}`
                    : "세션 선택"}
                </span>
                <span className="text-xs text-line-500">▼</span>
              </>
            }
          >
            {(close) => (
              <div className="max-h-64 overflow-y-auto">
                {openSessions.map((session) => (
                  <DropdownItem key={session.id} onClick={() => { setSelectedSessionId(session.id); close(); }}>
                    <span className={selectedSessionId === session.id ? "text-clay-400" : ""}>
                      {session.title} · {session.session_date}
                    </span>
                  </DropdownItem>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
      )}

      {selectedSession && (
        <>
          {/* ── 통계 + 확정/수정 버튼 ─────────────────── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                현재 명단
                {selectedSession.status === "closed" && (
                  <span className={`ml-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${
                    editingClosedSession ? "bg-clay-400/10 text-clay-400" : "bg-line-200 text-line-500"
                  }`}>
                    {editingClosedSession ? "수정 중" : "확정됨"}
                  </span>
                )}
              </p>
              {/* 명단 확정/수정 버튼 */}
              <div className="flex gap-1.5">
                {selectedSession.status === "open" && (
                  <button type="button"
                    disabled={processingSessionId === selectedSessionId}
                    onClick={() => handleSessionStatusChange(selectedSessionId!, "closed")}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-600 disabled:opacity-40">
                    명단 확정
                  </button>
                )}
                {selectedSession.status === "closed" && !editingClosedSession && (
                  <button type="button" onClick={() => setEditingClosedSession(true)}
                    className="rounded-sm border border-clay-400/60 px-2.5 py-1 text-[11px] font-semibold text-clay-400">
                    명단 수정
                  </button>
                )}
                {selectedSession.status === "closed" && editingClosedSession && (
                  <button type="button" onClick={() => setEditingClosedSession(false)}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500">
                    수정 완료
                  </button>
                )}
                {selectedSession.status !== "archived" && (
                  <button type="button"
                    disabled={processingSessionId === selectedSessionId}
                    onClick={() => handleSessionStatusChange(selectedSessionId!, "archived")}
                    className="rounded-sm border border-line-200/40 px-2.5 py-1 text-[11px] font-semibold text-line-500 disabled:opacity-40">
                    보관
                  </button>
                )}
              </div>
            </div>

            {/* 통계 3단 */}
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="grid grid-cols-3 divide-x divide-line-200/30">
                <button type="button" onClick={() => setStatusFilter(statusFilter === "attending" ? "all" : "attending")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "attending" ? "border-gold bg-gold/10" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-gold">{attending}</p>
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">출석</p>
                </button>
                <button type="button" onClick={() => setStatusFilter(statusFilter === "undecided" ? "all" : "undecided")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "undecided" ? "border-clay-400 bg-clay-400/10" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-clay-400">{undecided}</p>
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">미정</p>
                </button>
                <button type="button" onClick={() => setStatusFilter(statusFilter === "absent" ? "all" : "absent")}
                  className={`rounded-none p-3 text-center transition-colors ${statusFilter === "absent" ? "border-line-300 bg-line-200" : "border-line-200/40 bg-line-50"}`}>
                  <p className="font-score text-2xl font-bold text-line-500">{absent}</p>
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">불참</p>
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

          {/* ── 검색 ─────────────────────────────────── */}
          <div className="mb-3">
            <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="이름 검색"
              className="box-border block h-9 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-500" />
          </div>

          {/* ── 명단 — 출석 토글 (관리자 전용) ─────────── */}
          {loadingRows ? (
            <p className="text-center text-sm text-line-400">명단을 불러오는 중...</p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              {filteredRows.map((row, idx) => {
                const isLast = idx === filteredRows.length - 1;
                const label = getDisambiguatedName(row.member, rows.map((r) => r.member));
                const accentColor = row.status === "attending" ? "border-l-gold"
                  : row.status === "absent" ? "border-l-line-300"
                  : "border-l-clay-400";

                return (
                  <div key={row.member.id}
                    className={`flex items-center gap-3 border-l-4 ${accentColor} px-4 py-3 ${isLast ? "" : "border-b border-line-200/30"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-line-900">{label}</p>
                      {row.member.role && (
                        <span className="rounded-sm bg-line-200 px-1.5 py-0.5 text-[9px] font-semibold text-line-600">
                          {row.member.role}
                        </span>
                      )}
                    </div>
                    <AttendanceToggle
                      value={row.status}
                      onChange={(s) => updateStatus(row.member.id, s)}
                      disabled={
                        updatingMemberId === row.member.id ||
                        (selectedSession.status === "closed" && !editingClosedSession) ||
                        selectedSession.status === "archived"
                      }
                    />
                  </div>
                );
              })}
              {filteredRows.length === 0 && (
                <div className="p-8 text-center">
                  <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">No Results</p>
                </div>
              )}
            </div>
          )}
        </>
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
