"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import type { AttendanceStatus, AttendanceSession, Member } from "@/lib/supabase/database.types";

const MIN_REQUIRED_PLAYERS = 4;

const SESSION_DAY_LABEL: Record<AttendanceSession["session_day"], string> = {
  saturday: "토요 정기운동",
  sunday: "일요 정기운동",
  holiday: "휴일운동",
  custom: "임시운동",
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MemberAttendance {
  member: Member;
  status: AttendanceStatus;
  attendanceId: string | null;
}

export default function AttendancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberAttendance[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDate, setCustomDate] = useState(todayString());
  const [customDay, setCustomDay] = useState<"holiday" | "custom">("custom");
  const [customTitle, setCustomTitle] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);

  // 1. open 상태인 세션 목록 불러오기
  useEffect(() => {
    let isCurrent = true;

    async function loadSessions() {
      setLoadingSessions(true);
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("status", "open")
        .order("session_date", { ascending: true });

      if (!isCurrent) return;

      const sessions = (data ?? []) as AttendanceSession[];
      setOpenSessions(sessions);
      setSelectedSessionId((prev) => prev ?? sessions[0]?.id ?? null);
      setLoadingSessions(false);
    }

    loadSessions();
    return () => {
      isCurrent = false;
    };
  }, [supabase]);

  // 2. 선택된 세션의 출석 현황 불러오기
  useEffect(() => {
    if (!selectedSessionId) {
      setRows([]);
      return;
    }

    let isCurrent = true;
    setLoadingRows(true);

    async function loadRows() {
      const [{ data: members }, { data: attendance }] = await Promise.all([
        supabase.from("members").select("*").eq("is_active", true).order("nickname"),
        supabase.from("attendance").select("*").eq("session_id", selectedSessionId),
      ]);

      if (!isCurrent) return;

      const attendanceByMember = new Map((attendance ?? []).map((a) => [a.member_id, a]));

      setRows(
        (members ?? []).map((member) => {
          const existing = attendanceByMember.get(member.id);
          return {
            member,
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

  async function updateStatus(memberId: string, newStatus: AttendanceStatus) {
    if (!selectedSessionId) {
      alert("출석 세션을 선택해주세요.");
      return;
    }

    const previousStatus = rows.find((r) => r.member.id === memberId)?.status ?? "undecided";

    // 낙관적 업데이트: 먼저 화면에 반영
    setRows((prev) =>
      prev.map((row) => (row.member.id === memberId ? { ...row, status: newStatus } : row))
    );
    setUpdatingMemberId(memberId);

    const { data, error } = await supabase
      .from("attendance")
      .upsert(
        {
          member_id: memberId,
          session_id: selectedSessionId,
          event_date:
            openSessions.find((s) => s.id === selectedSessionId)?.session_date ??
            new Date().toISOString().slice(0, 10),
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id,session_id" }
      )
      .select()
      .single();

    setUpdatingMemberId(null);

    if (error || !data) {
      // 실패 시 기존 상태로 롤백
      setRows((prev) =>
        prev.map((row) => (row.member.id === memberId ? { ...row, status: previousStatus } : row))
      );
      alert("출석 변경에 실패했습니다.");
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.member.id === memberId ? { ...row, attendanceId: data.id } : row))
    );
  }

  async function handleCreateWeeklySessions() {
    const confirmed = window.confirm(
      "기존 열린 토/일 출석 세션을 보관하고 이번 주 토/일 세션을 새로 생성합니다. 진행할까요?"
    );
    if (!confirmed) return;

    const res = await fetch("/api/attendance-sessions/weekly", { method: "POST" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      alert(body?.error ?? "세션 생성에 실패했습니다.");
      return;
    }

    alert("이번 주 출석 세션이 생성되었습니다.");
    window.location.reload();
  }

  async function handleCreateCustomSession() {
    if (!customDate) {
      alert("날짜를 선택해주세요.");
      return;
    }
    if (!customDay) {
      alert("운동 구분을 선택해주세요.");
      return;
    }
    if (!customTitle.trim()) {
      alert("제목을 입력해주세요.");
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
      alert(body?.error ?? "세션 생성에 실패했습니다.");
      return;
    }

    alert("세션이 생성되었습니다.");
    window.location.reload();
  }

  async function handleSessionStatusChange(sessionId: string, targetStatus: "closed" | "archived") {
    const confirmMessage =
      targetStatus === "closed"
        ? "이 세션을 마감 처리할까요?"
        : "이 세션을 보관 처리할까요? 보관 후에는 출석 화면에 노출되지 않습니다.";

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
      alert(
        body?.error ??
          (targetStatus === "closed" ? "세션 마감 처리에 실패했습니다." : "세션 보관 처리에 실패했습니다.")
      );
      return;
    }

    alert(targetStatus === "closed" ? "세션이 마감되었습니다." : "세션이 보관되었습니다.");
    window.location.reload();
  }

  const attending = rows.filter((r) => r.status === "attending").length;
  const undecided = rows.filter((r) => r.status === "undecided").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);

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
      </header>

      <div className="mb-3 flex gap-2">
        <Button variant="ghost" size="md" onClick={handleCreateWeeklySessions} className="flex-1">
          이번 주 출석 세션 생성
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => setShowCustomForm((v) => !v)}
          className="flex-1"
        >
          {showCustomForm ? "닫기" : "휴일/임시운동 생성"}
        </Button>
      </div>

      {showCustomForm && (
        <Card className="mb-4 space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">날짜</label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">운동 구분</label>
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
                휴일운동
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
                임시운동
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">제목</label>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="예: 광복절 특별 운동"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>
          <Button
            size="md"
            className="w-full"
            disabled={creatingCustom}
            onClick={handleCreateCustomSession}
          >
            {creatingCustom ? "생성 중..." : "세션 생성"}
          </Button>
        </Card>
      )}

      {loadingSessions ? (
        <p className="text-center text-sm text-line-400">세션을 불러오는 중...</p>
      ) : openSessions.length === 0 ? (
        <Card className="mb-4 p-6 text-center text-sm text-line-400">
          현재 진행 중인 출석 세션이 없어요. "이번 주 출석 세션 생성"을 눌러주세요.
        </Card>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {openSessions.map((session) => {
            const isCustomSession = session.session_day === "holiday" || session.session_day === "custom";
            return (
              <div key={session.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedSessionId === session.id
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 bg-line-50 text-line-800"
                  }`}
                >
                  {SESSION_DAY_LABEL[session.session_day]}
                </button>
                {isCustomSession && (
                  <>
                    <button
                      type="button"
                      disabled={processingSessionId === session.id}
                      onClick={() => handleSessionStatusChange(session.id, "closed")}
                      className="rounded-full border border-line-200 px-2 py-1 text-[11px] font-semibold text-line-600 disabled:opacity-40"
                    >
                      마감
                    </button>
                    <button
                      type="button"
                      disabled={processingSessionId === session.id}
                      onClick={() => handleSessionStatusChange(session.id, "archived")}
                      className="rounded-full border border-line-200 px-2 py-1 text-[11px] font-semibold text-line-600 disabled:opacity-40"
                    >
                      보관
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSessionId && (
        <>
          <Card className="mb-4 flex items-center justify-between p-4">
            <div>
              <p className="font-score text-2xl font-bold text-line-900">
                {attending}
                <span className="text-sm text-line-400"> / {rows.length}명</span>
              </p>
              <p className="text-xs text-line-500">
                미정 {undecided} · 불참 {absent}
              </p>
            </div>
            {shortage > 0 ? (
              <Badge tone="fault">{shortage}명 더 필요해요</Badge>
            ) : (
              <Badge tone="court">복식 경기 가능</Badge>
            )}
          </Card>

          {loadingRows ? (
            <p className="text-center text-sm text-line-400">불러오는 중...</p>
          ) : (
            <div className="space-y-2">
              {rows.map(({ member, status }) => (
                <Card key={member.id} className="flex items-center justify-between p-3">
                  <span className="text-sm font-medium text-line-900">{member.nickname}</span>
                  <AttendanceToggle
                    value={status}
                    onChange={(s) => updateStatus(member.id, s)}
                    disabled={updatingMemberId === member.id}
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
