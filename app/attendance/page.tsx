"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/Toast";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import { getDisambiguatedName } from "@/lib/member-display";
import { MATCH_SESSION_DAY_LABEL, fetchActiveSessions } from "@/lib/match-session-label";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberAttendance[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  // closed 세션에서 운영진이 "명단 수정" 버튼을 눌러야만 토글이 활성화된다.
  const [editingClosedSession, setEditingClosedSession] = useState(false);

  // 휴일매치/이벤트매치 생성 폼
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDate, setCustomDate] = useState(todayString());
  const [customDay, setCustomDay] = useState<"holiday" | "custom">("custom");
  const [customTitle, setCustomTitle] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  // 0. 운영진 여부 확인 — manager 이상만 세션 생성/명단확정/명단보관 버튼을 본다.
  // 카카오 로그인 + permission_role 도입 전까지는 운영진 비밀번호 인증으로 대체.
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((body) => setIsAdmin(Boolean(body?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

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

    if (!selectedSessionId) {
      setRows([]);
      return;
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
  }, [selectedSessionId, supabase]);

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

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clay-400" />
            <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
              Attendance
            </p>
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">출석 체크</h1>
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
                  {selectedSession ? MATCH_SESSION_DAY_LABEL[selectedSession.session_day] : "세션 선택"}
                  {selectedSessionIsCustom && selectedSession ? ` · ${selectedSession.title}` : ""}
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
                      {MATCH_SESSION_DAY_LABEL[session.session_day]}
                      {(session.session_day === "holiday" || session.session_day === "custom") &&
                        ` · ${session.title}`}
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

          <div className="mb-4 grid grid-cols-3 gap-2">
            <Card className="p-3 text-center">
              <p className="font-score text-2xl font-bold text-court-400">{attending}</p>
              <p className="text-xs text-line-500">출석</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="font-score text-2xl font-bold text-amber-400">{undecided}</p>
              <p className="text-xs text-line-500">미정</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="font-score text-2xl font-bold text-fault-400">{absent}</p>
              <p className="text-xs text-line-500">불참</p>
            </Card>
          </div>

          <div className="mb-4 flex justify-center">
            {shortage > 0 ? (
              <Badge tone="fault">{shortage}명 더 필요해요</Badge>
            ) : (
              <Badge tone="court">복식 경기 가능</Badge>
            )}
          </div>

          {loadingRows ? (
            <p className="text-center text-sm text-line-400">불러오는 중...</p>
          ) : (
            <div className="space-y-2">
              {rows.map(({ member, status }) => (
                <Card key={member.id} className="flex items-center justify-between p-3">
                  <span className="text-sm font-medium text-line-900">
                    {getDisambiguatedName(member, allMembers)}
                  </span>
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
