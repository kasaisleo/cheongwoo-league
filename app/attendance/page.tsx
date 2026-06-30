"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/Toast";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import { MemberAttendanceCard } from "@/components/attendance/MemberAttendanceCard";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
import { useAdminRole } from "@/lib/hooks/useAdminRole";
import type { AttendanceStatus, AttendanceSession, Member } from "@/lib/supabase/database.types";

const MIN_REQUIRED_PLAYERS = 4;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MemberAttendance {
  member: Member;
  status: AttendanceStatus;
  attendanceId: string | null;
}

function AttendancePageInner() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("session_id");
  const supabase = useMemo(() => createClient(), []);

  // Step 13 권한 체계 — useAdminRole() 하나로 /api/auth/status를 1회만 호출해
  // owner/manager/비운영진을 구분한다. useIsAdmin()과 별도로 호출하면 같은
  // 엔드포인트를 2회 호출하므로 useAdminRole()로 통합한다.
  const role = useAdminRole();    // "owner" | "manager" | null
  const isAdmin = role !== null;  // manager 이상 — 기존 isAdmin 동작과 동일
  // isOwner = role === "owner"  향후 owner 전용 기능 추가 시 활성화
  // isManager = role === "manager"  향후 manager 전용 기능 추가 시 활성화

  // 회원 카카오 로그인 상태 — "내 출석 신청" 영역 표시 여부 결정.
  // undefined = 아직 확인 중, null = 미로그인 또는 미연결
  const [myMemberId, setMyMemberId] = useState<string | null | undefined>(undefined);

  // 명단 영역 표시 모드 — myMemberId 로딩(undefined) 구간 동안 깜빡임 없이
  // 권한별 분기를 결정한다.
  //   "loading"  : myMemberId 확인 중 (명단 영역 전체 숨김)
  //   "guest"    : 비로그인 (통계+안내만, 명단 숨김)
  //   "member"   : 일반 회원 (읽기 전용 명단)
  //   "admin"    : 운영진 (풀 기능)
  const viewMode: "loading" | "guest" | "member" | "admin" =
    isAdmin
      ? "admin"
      : myMemberId === undefined
        ? "loading"
        : myMemberId === null
          ? "guest"
          : "member";

  const [mySessionStatus, setMySessionStatus] = useState<AttendanceStatus | null>(null);
  const [mySessionSubmitting, setMySessionSubmitting] = useState(false);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberAttendance[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  // closed 세션에서 운영진이 "명단 수정" 버튼을 눌러야만 토글이 활성화된다.
  const [editingClosedSession, setEditingClosedSession] = useState(false);
  // 명단 검색/상태 필터(UX 전용 — 서버 조회나 통계 집계에는 영향을 주지
  // 않는다. 통계 카드 숫자는 항상 rows 전체 기준으로 고정한다).
  const [memberQuery, setMemberQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");

  // 휴일매치/이벤트매치 생성 폼
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDate, setCustomDate] = useState(todayString());
  const [customDay, setCustomDay] = useState<"holiday" | "custom">("custom");
  const [customTitle, setCustomTitle] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  // 0. 카카오 로그인 회원 확인 — "내 출석 신청" 영역을 위한 본인 member_id 조회
  useEffect(() => {
    void (async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { setMyMemberId(null); return; }
      const { data: member } = await supabase
        .from("members").select("id")
        .eq("auth_user_id", authSession.user.id).maybeSingle();
      setMyMemberId(member?.id ?? null);
    })();
  }, [supabase]);

  // 선택 세션이 바뀌면 내 출석 상태도 다시 조회
  const refreshMyStatus = useCallback(async (sessionId: string, memberId: string) => {
    const { data } = await supabase
      .from("attendance").select("status")
      .eq("session_id", sessionId).eq("member_id", memberId).maybeSingle();
    setMySessionStatus((data?.status as AttendanceStatus | null) ?? null);
  }, [supabase]);

  // 1. open 상태인 세션 목록 불러오기. URL의 session_id가 있고 목록에 실제로 존재하면 그걸 우선 선택한다.
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
          ? initialSessionId
          : null;
        return fromUrl ?? sessions[0]?.id ?? null;
      });
      setLoadingSessions(false);
    }

    loadSessions();
    return () => {
      isCurrent = false;
    };
  }, [supabase, initialSessionId]);

  // 2. 선택된 세션의 출석 현황 불러오기
  useEffect(() => {
    setEditingClosedSession(false);
    setMemberQuery("");
    setStatusFilter("all");
    setMySessionStatus(null);

    if (!selectedSessionId) {
      setRows([]);
      return;
    }

    // 내 출석 상태 조회
    if (myMemberId) {
      void refreshMyStatus(selectedSessionId, myMemberId);
    }

    let isCurrent = true;
    setLoadingRows(true);

    async function loadRows() {
      const [{ data: members }, { data: attendance }] = await Promise.all([
        supabase
          .from("members")
          .select("*")
          .eq("is_active", true)
          .eq("is_dormant", false)
          .order("nickname"),
        supabase.from("attendance").select("*").eq("session_id", selectedSessionId),
      ]);

      if (!isCurrent) return;

      const attendanceByMember = new Map((attendance ?? []).map((a) => [a.member_id, a]));

      setRows(
        (members ?? []).map((member) => {
          const existing = attendanceByMember.get(member.id);
          return {
            member,
            // 기본 상태는 미정(undecided)
            status: existing?.status ?? "undecided",
            attendanceId: existing?.id ?? null,
          };
        })
      );
      setLoadingRows(false);
    }

    loadRows();
    return () => {
      isCurrent = false;
    };
  }, [selectedSessionId, supabase, myMemberId, refreshMyStatus]);

  // 3-my. 회원 본인 출석 신청 핸들러 (POST /api/member/attendance 사용)
  async function handleMyStatusChange(status: AttendanceStatus) {
    if (!myMemberId || !selectedSessionId) return;
    const prev = mySessionStatus;
    setMySessionStatus(status); // 낙관적 업데이트
    setMySessionSubmitting(true);
    try {
      const res = await fetch("/api/member/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMySessionStatus(prev);
        toast.error(data?.error ?? "출석 변경에 실패했습니다.");
      } else {
        const LABEL: Record<AttendanceStatus, string> = { attending: "참석", undecided: "미정", absent: "불참" };
        toast.success(`${LABEL[status]}으로 변경되었습니다.`);
        // 전체 명단 통계 갱신을 위해 rows 재조회
        await refreshMyStatus(selectedSessionId, myMemberId);
      }
    } catch {
      setMySessionStatus(prev);
      toast.error("출석 변경 중 오류가 발생했습니다.");
    } finally {
      setMySessionSubmitting(false);
    }
  }

  // 3. 출석 상태 변경 — 즉시 화면(통계 포함) 반영, 새로고침 없음. 실패 시 롤백.
  //    - open: 회원 본인이 RLS를 통해 직접 upsert
  //    - closed: 일반 회원은 RLS가 막음. 운영진은 admin-update API(service-role)로 보정
  //    - archived: 읽기 전용 — 이 함수를 호출하는 토글 자체가 비활성화되어 있어야 한다
  async function updateStatus(memberId: string, newStatus: AttendanceStatus) {
    if (!selectedSessionId || !selectedSession) {
      toast.error("출석 세션을 선택해주세요.");
      return;
    }

    if (selectedSession.status === "archived") {
      toast.error("보관된 세션은 읽기 전용이라 수정할 수 없습니다.");
      return;
    }

    const previousStatus = rows.find((r) => r.member.id === memberId)?.status ?? "undecided";

    setRows((prev) =>
      prev.map((row) => (row.member.id === memberId ? { ...row, status: newStatus } : row))
    );
    setUpdatingMemberId(memberId);

    let succeeded: boolean;
    let newAttendanceId: string | null = null;

    if (selectedSession.status === "closed") {
      // 명단이 확정된 세션 — 운영진만 보정 가능. 별도 service-role API를 거친다.
      if (!isAdmin) {
        setUpdatingMemberId(null);
        setRows((prev) =>
          prev.map((row) => (row.member.id === memberId ? { ...row, status: previousStatus } : row))
        );
        toast.error("명단이 확정된 세션은 운영진만 수정할 수 있습니다.");
        return;
      }

      const res = await fetch("/api/attendance/admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, sessionId: selectedSessionId, status: newStatus }),
      });
      const body = await res.json().catch(() => null);
      succeeded = res.ok;
      newAttendanceId = body?.attendance?.id ?? null;
    } else {
      // open 세션 — 회원 본인이 RLS를 통해 직접 upsert
      const { data, error } = await supabase
        .from("attendance")
        .upsert(
          {
            member_id: memberId,
            session_id: selectedSessionId,
            event_date: selectedSession.session_date,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id,session_id" }
        )
        .select()
        .single();

      succeeded = !error && Boolean(data);
      newAttendanceId = data?.id ?? null;
    }

    setUpdatingMemberId(null);

    if (!succeeded) {
      setRows((prev) =>
        prev.map((row) => (row.member.id === memberId ? { ...row, status: previousStatus } : row))
      );
      toast.error("출석 변경에 실패했습니다.");
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.member.id === memberId ? { ...row, attendanceId: newAttendanceId } : row))
    );
  }

  async function handleCreateWeeklySessions(closeMenu?: () => void) {
    closeMenu?.();
    const confirmed = window.confirm(
      "기존 열린 토/일 출석 세션을 보관하고 이번 주 토/일 세션을 새로 생성합니다. 진행할까요?"
    );
    if (!confirmed) return;

    const res = await fetch("/api/attendance-sessions/weekly", { method: "POST" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      toast.error(body?.error ?? "세션 생성에 실패했습니다.");
      return;
    }

    toast.success("이번 주 출석 세션이 생성되었습니다.");
    window.location.reload();
  }

  async function handleCreateCustomSession() {
    if (!customDate) {
      toast.error("날짜를 선택해주세요.");
      return;
    }
    if (customDate < todayString()) {
      toast.error("오늘 이전 날짜는 선택할 수 없습니다.");
      return;
    }
    if (!customDay) {
      toast.error("운동 구분을 선택해주세요.");
      return;
    }
    if (!customTitle.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    setCreatingCustom(true);
    const res = await fetch("/api/attendance-sessions/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDate: customDate, sessionDay: customDay, title: customTitle.trim() }),
    });
    const body = await res.json().catch(() => null);
    setCreatingCustom(false);

    if (!res.ok) {
      toast.error(body?.error ?? "세션 생성에 실패했습니다.");
      return;
    }

    toast.success("세션이 생성되었습니다.");
    window.location.reload();
  }

  // 용어 정리: closed = "명단 확정", archived = "명단 보관"
  // 보관은 데이터 삭제가 아니라 화면에서 숨기고 히스토리로 옮기는 개념.
  async function handleSessionStatusChange(
    sessionId: string,
    targetStatus: "closed" | "archived",
    closeMenu?: () => void
  ) {
    closeMenu?.();
    const confirmMessage =
      targetStatus === "closed"
        ? "이 출석 명단을 확정하시겠습니까?"
        : "이 출석 명단을 보관하시겠습니까?";

    if (!window.confirm(confirmMessage)) return;

    setProcessingSessionId(sessionId);
    const res = await fetch("/api/attendance-sessions/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, targetStatus }),
    });
    const body = await res.json().catch(() => null);
    setProcessingSessionId(null);

    if (!res.ok) {
      toast.error(
        body?.error ??
          (targetStatus === "closed" ? "명단 확정에 실패했습니다." : "명단 보관에 실패했습니다.")
      );
      return;
    }

    toast.success(targetStatus === "closed" ? "출석 명단이 확정되었습니다." : "출석 명단이 보관되었습니다.");
    window.location.reload();
  }

  const allMembers = rows.map((r) => r.member);
  const attending = rows.filter((r) => r.status === "attending").length;
  const undecided = rows.filter((r) => r.status === "undecided").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);
  const selectedSession = openSessions.find((s) => s.id === selectedSessionId) ?? null;
  const selectedSessionIsCustom =
    selectedSession?.session_day === "holiday" || selectedSession?.session_day === "custom";

  // 명단에 실제로 표시할 목록 — 검색어(이름/닉네임 기준)와 상태 필터를 AND로
  // 적용한다. 통계 숫자(attending/undecided/absent/shortage)는 위에서 이미
  // rows 전체로 계산해뒀으므로 이 필터링과 무관하게 그대로 유지된다 —
  // "출석 카드를 눌러서 목록만 좁혀 봐도, 전체 통계는 흔들리지 않아야" 한다.
  const normalizedQuery = memberQuery.trim().toLowerCase();
  const displayedRows = rows.filter((row) => {
    const matchesQuery =
      normalizedQuery === "" ||
      row.member.name?.toLowerCase().includes(normalizedQuery) ||
      row.member.nickname?.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">
            Attendance
          </p>
          <h1 className="headline-kr text-4xl text-line-900">출석 체크</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/attendance/history"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line-200 bg-line-100 text-line-700 transition-colors hover:bg-line-200"
            aria-label="출석 히스토리 보기"
          >
            <span className="text-base">🕓</span>
          </Link>

          {/* 관리자 메뉴 — 운영진에게만 노출 */}
          {isAdmin && (
            <Dropdown
              align="right"
              triggerClassName="flex h-10 w-10 items-center justify-center rounded-full border border-line-200 bg-line-100 text-line-700 transition-colors hover:bg-line-200"
              trigger={<span className="text-lg">⚙</span>}
            >
              {(close) => (
                <div className="space-y-0.5">
                  <DropdownItem onClick={() => handleCreateWeeklySessions(close)}>
                    이번 주 세션 생성
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setCustomDate((prev) => (prev < todayString() ? todayString() : prev));
                      setShowCustomForm(true);
                      close();
                    }}
                  >
                    휴일매치/이벤트매치 생성
                  </DropdownItem>
                  {selectedSessionId && selectedSession && (
                    <>
                      <div className="my-1 h-px bg-line-200" />
                      {selectedSession.status === "open" && (
                        <DropdownItem
                          disabled={processingSessionId === selectedSessionId}
                          onClick={() => handleSessionStatusChange(selectedSessionId, "closed", close)}
                        >
                          명단 확정
                        </DropdownItem>
                      )}
                      {selectedSession.status === "closed" && (
                        <DropdownItem
                          disabled={processingSessionId === selectedSessionId}
                          onClick={() => handleSessionStatusChange(selectedSessionId, "archived", close)}
                        >
                          매치 보관
                        </DropdownItem>
                      )}
                    </>
                  )}
                </div>
              )}
            </Dropdown>
          )}
        </div>
      </header>

      {showCustomForm && isAdmin && (
        <Card className="mb-4 space-y-3 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wide text-clay-400">휴일매치/이벤트매치 생성</p>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="text-xs font-semibold text-line-500"
            >
              닫기
            </button>
          </div>
          <div className="w-full overflow-hidden">
            <label className="mb-1 block text-xs font-semibold text-line-600">날짜 *</label>
            <input
              type="date"
              value={customDate}
              min={todayString()}
              onChange={(e) => setCustomDate(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">구분 *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomDay("holiday")}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  customDay === "holiday"
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                휴일매치
              </button>
              <button
                type="button"
                onClick={() => setCustomDay("custom")}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  customDay === "custom"
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                이벤트매치
              </button>
            </div>
          </div>
          <div className="w-full">
            <label className="mb-1 block text-xs font-semibold text-line-600">제목 *</label>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="예: 광복절 특별 매치, 청우회 VS 망원클럽 친선전"
              className="box-border block h-11 w-full max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>
          <button
            type="button"
            disabled={creatingCustom}
            onClick={handleCreateCustomSession}
            className="h-11 w-full rounded-lg bg-clay-400 text-sm font-bold text-line-25 transition-colors disabled:opacity-40"
          >
            {creatingCustom ? "생성 중..." : "세션 생성"}
          </button>
        </Card>
      )}

      {/* 세션 선택 — 드롭다운 방식. 휴일매치/이벤트매치가 늘어나도 화면이 밀리지 않음 */}
      {loadingSessions ? (
        <p className="text-center text-sm text-line-400">세션을 불러오는 중...</p>
      ) : openSessions.length === 0 ? (
        <Card className="mb-4 p-6 text-center text-sm text-line-400">
          {isAdmin
            ? "현재 진행 중인 출석 세션이 없어요. 우측 상단 ⚙ 메뉴에서 세션을 만들어주세요."
            : "현재 진행 중인 출석 세션이 없어요."}
        </Card>
      ) : (
        <div className="mb-4">
          <Dropdown
            align="left"
            triggerClassName="flex w-full items-center justify-between rounded-lg border border-line-200 bg-line-100 px-4 py-3 text-left"
            trigger={
              <>
                <span className="text-sm font-semibold text-line-900">
                  {selectedSession ? selectedSession.title : "세션 선택"}
                  {selectedSession && (
                    <span className="ml-1 text-xs font-normal text-line-400">
                      · {MATCH_SESSION_DAY_LABEL[selectedSession.session_day]}
                    </span>
                  )}
                </span>
                <span className="text-line-500">▼</span>
              </>
            }
          >
            {(close) => (
              <div className="space-y-0.5">
                {openSessions.map((session) => (
                  <DropdownItem
                    key={session.id}
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      close();
                    }}
                  >
                    <span className={selectedSessionId === session.id ? "text-clay-400" : ""}>
                      {session.title}
                      <span className="ml-1 text-xs font-normal opacity-60">
                        · {MATCH_SESSION_DAY_LABEL[session.session_day]}
                      </span>
                    </span>
                  </DropdownItem>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
      )}

      {selectedSessionId && (
        <>
          {/* 내 출석 신청 — 로그인한 회원에게만 표시. 선택된 세션 기준으로 연동.
              미로그인(myMemberId===null) 또는 로딩 중(undefined)이면 숨긴다. */}
          {myMemberId && selectedSession && (
            <div className="mb-4">
              <MemberAttendanceCard
                session={selectedSession}
                myStatus={mySessionStatus}
                onStatusChange={handleMyStatusChange}
                submitting={mySessionSubmitting}
                showStats={false}
                sessionClosed={selectedSession.status !== "open"}
              />
            </div>
          )}

          {/* 통계 카드 + 운영진 전용 명단확정/명단보관 버튼을 같은 영역에 노출 */}
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-line-500">
              현재 명단
              {selectedSession?.status === "closed" && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    editingClosedSession
                      ? "bg-clay-400/20 text-clay-400"
                      : "bg-amber-400/20 text-amber-400"
                  }`}
                >
                  {editingClosedSession ? "수정 중" : "확정됨"}
                </span>
              )}
            </p>
            {isAdmin && selectedSession && (
              <div className="flex gap-1.5">
                {selectedSession.status === "open" && (
                  <button
                    type="button"
                    disabled={processingSessionId === selectedSessionId}
                    onClick={() => handleSessionStatusChange(selectedSessionId, "closed")}
                    className="rounded-full border border-line-200 px-2.5 py-1 text-[11px] font-semibold text-line-600 disabled:opacity-40"
                  >
                    명단 확정
                  </button>
                )}
                {selectedSession.status === "closed" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingClosedSession((v) => !v)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        editingClosedSession
                          ? "border-clay-400 bg-clay-400 text-line-25"
                          : "border-line-200 text-line-600"
                      }`}
                    >
                      {editingClosedSession ? "수정 완료" : "명단 수정"}
                    </button>
                    <button
                      type="button"
                      disabled={processingSessionId === selectedSessionId}
                      onClick={() => handleSessionStatusChange(selectedSessionId, "archived")}
                      className="rounded-full border border-line-200 px-2.5 py-1 text-[11px] font-semibold text-line-600 disabled:opacity-40"
                    >
                      매치 보관
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 카드를 누르면 그 상태로 명단을 좁혀 본다. 이미 선택된 카드를 다시
              누르면 "전체"로 돌아간다(토글) — 한 번 더 누르는 것 외에 별도
              "전체 보기" 버튼을 만들지 않아도 빠르게 되돌릴 수 있다. */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === "attending" ? "all" : "attending"))}
              className={`rounded-xl border p-3 text-center transition-colors ${
                statusFilter === "attending"
                  ? "border-win bg-win/10"
                  : "border-line-200 bg-line-100"
              }`}
            >
              <p className="font-score text-2xl font-bold text-win">{attending}</p>
              <p className="text-xs text-line-500">출석</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === "undecided" ? "all" : "undecided"))}
              className={`rounded-xl border p-3 text-center transition-colors ${
                statusFilter === "undecided"
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-line-200 bg-line-100"
              }`}
            >
              <p className="font-score text-2xl font-bold text-amber-400">{undecided}</p>
              <p className="text-xs text-line-500">미정</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === "absent" ? "all" : "absent"))}
              className={`rounded-xl border p-3 text-center transition-colors ${
                statusFilter === "absent"
                  ? "border-loss bg-loss/10"
                  : "border-line-200 bg-line-100"
              }`}
            >
              <p className="font-score text-2xl font-bold text-loss">{absent}</p>
              <p className="text-xs text-line-500">불참</p>
            </button>
          </div>

          <div className="mb-4 flex justify-center">
            {shortage > 0 ? (
              <Badge tone="fault">{shortage}명 더 필요해요</Badge>
            ) : (
              <Badge tone="court">복식 경기 가능</Badge>
            )}
          </div>

          {/* ─── 명단 영역 — viewMode에 따른 권한별 분기 ────────────────────
              loading : myMemberId 확인 중 → 명단 전체 숨김 (깜빡임 방지)
              guest   : 비로그인  → 통계까지만, 안내 + 카카오 로그인 CTA
              member  : 일반 회원 → 이름+상태 읽기 전용, 수정 불가
              admin   : 운영진    → 기존 풀 기능
          ──────────────────────────────────────────────────────────── */}

          {viewMode === "loading" && (
            <p className="text-center text-sm text-line-400">불러오는 중...</p>
          )}

          {viewMode === "guest" && (
            <Card className="p-5 text-center">
              <p className="text-sm text-line-600">
                로그인하면 출석 신청과 명단 확인이 가능합니다.
              </p>
              <a
                href="/login"
                className="mt-3 inline-block rounded-lg bg-[#FEE500] px-5 py-2 text-sm font-bold text-[#191600]"
              >
                카카오 로그인
              </a>
            </Card>
          )}

          {viewMode === "member" && (
            <>
              <div className="mb-3">
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="이름, 닉네임으로 검색"
                  className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
                />
              </div>
              {loadingRows ? (
                <p className="text-center text-sm text-line-400">불러오는 중...</p>
              ) : displayedRows.length === 0 ? (
                <Card className="p-6 text-center text-sm text-line-400">
                  {rows.length === 0 ? "명단이 비어 있어요." : "검색/필터 조건에 맞는 회원이 없어요."}
                </Card>
              ) : (
                <div className="space-y-2">
                  {displayedRows.map(({ member, status }) => (
                    <Card
                      key={member.id}
                      className={`flex items-center justify-between gap-2 border-l-4 p-3 ${
                        status === "attending"
                          ? "border-l-win"
                          : status === "absent"
                            ? "border-l-loss"
                            : "border-l-amber-400"
                      }`}
                    >
                      {/* 이름만 표시 — 전화번호/메모 등 민감 정보 제외 */}
                      <span className="text-sm font-medium text-line-900">
                        {getDisambiguatedName(member, allMembers)}
                      </span>
                      {/* 읽기 전용 배지 — 수정 토글 없음 */}
                      <Badge
                        tone={
                          status === "attending"
                            ? "court"
                            : status === "absent"
                              ? "fault"
                              : "amber"
                        }
                      >
                        {status === "attending" ? "참석" : status === "absent" ? "불참" : "미정"}
                      </Badge>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === "admin" && (
            <>
              <div className="mb-3">
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="이름, 닉네임으로 검색"
                  className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
                />
              </div>
              {loadingRows ? (
                <p className="text-center text-sm text-line-400">불러오는 중...</p>
              ) : displayedRows.length === 0 ? (
                <Card className="p-6 text-center text-sm text-line-400">
                  {rows.length === 0 ? "명단이 비어 있어요." : "검색/필터 조건에 맞는 회원이 없어요."}
                </Card>
              ) : (
                <div className="space-y-2">
                  {displayedRows.map(({ member, status }) => (
                    <Card
                      key={member.id}
                      className={`flex items-center justify-between gap-2 border-l-4 p-3 ${
                        status === "attending"
                          ? "border-l-win"
                          : status === "absent"
                            ? "border-l-loss"
                            : "border-l-amber-400"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-line-900">
                          {getDisambiguatedName(member, allMembers)}
                        </span>
                        {member.member_type !== "정회원" && (
                          <Badge tone="neutral">{member.member_type}</Badge>
                        )}
                      </div>
                      <AttendanceToggle
                        value={status}
                        onChange={(s) => updateStatus(member.id, s)}
                        disabled={
                          updatingMemberId === member.id ||
                          (selectedSession?.status === "closed" && !(isAdmin && editingClosedSession))
                        }
                      />
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={null}>
      <AttendancePageInner />
    </Suspense>
  );
}
