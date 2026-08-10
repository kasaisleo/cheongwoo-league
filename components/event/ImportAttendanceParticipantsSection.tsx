"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { EventParticipant } from "@/lib/supabase/database.types";

interface AttendanceSessionCandidate {
  id: string;
  session_date: string;
  session_day: string;
  title: string;
  status: string;
  attendingCount: number;
  guestCount: number;
}

interface ImportResult {
  inserted_count: number;
  reactivated_count: number;
  skipped_duplicate_count: number;
  skipped_excluded_count: number;
  skipped_inactive_member_count: number;
  skipped_inactive_guest_count: number;
}

const RESULT_LABELS: Array<{ key: keyof ImportResult; label: string }> = [
  { key: "inserted_count", label: "신규 추가" },
  { key: "reactivated_count", label: "참가 복구" },
  { key: "skipped_duplicate_count", label: "이미 참가 중" },
  { key: "skipped_excluded_count", label: "제외 상태 유지" },
  { key: "skipped_inactive_member_count", label: "비활성 회원 제외" },
  { key: "skipped_inactive_guest_count", label: "비활성 게스트 제외" },
];

interface ImportAttendanceParticipantsSectionProps {
  eventId: string;
  participants: EventParticipant[];
  onChanged: () => void;
}

/**
 * ImportAttendanceParticipantsSection — 출석 명단 가져오기(2A-4B).
 *
 * import_event_participants_from_attendance RPC 경유. 6개 counter는 API 응답을
 * 그대로 표시한다(클라이언트 재계산 없음). "이미 가져온 세션" 표시는 참가자의
 * source_attendance_session_id를 그대로 이용 — 별도 조회를 추가하지 않는다.
 */
export function ImportAttendanceParticipantsSection({
  eventId,
  participants,
  onChanged,
}: ImportAttendanceParticipantsSectionProps) {
  const [sessions, setSessions] = useState<AttendanceSessionCandidate[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    async function load() {
      setLoadingSessions(true);
      const res = await fetch(`/api/admin/events/${eventId}/attendance-sessions`);
      const body = await res.json().catch(() => null);
      setLoadingSessions(false);
      if (res.ok) setSessions(body.sessions ?? []);
    }
    load();
  }, [eventId]);

  const importedSessionIds = useMemo(
    () =>
      new Set(
        participants
          .map((p) => p.source_attendance_session_id)
          .filter((id): id is string => Boolean(id))
      ),
    [participants]
  );

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  async function handleImport() {
    if (!selectedId || importing) return; // 동일 요청 연속 클릭 방지
    setImporting(true);
    const res = await fetch(`/api/admin/events/${eventId}/participants/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceSessionId: selectedId }),
    });
    const body = await res.json().catch(() => null);
    setImporting(false);
    if (!res.ok) {
      toast.error(body?.error ?? "출석 명단 가져오기에 실패했습니다.");
      return;
    }
    toast.success("출석 명단을 가져왔습니다.");
    setLastResult(body);
    onChanged();
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)]">
      <div className="px-4 py-2.5">
        <p className="text-[11px] font-semibold text-[color:var(--surface-muted)]">출석 명단 가져오기</p>
      </div>

      <div className="border-t border-[color:var(--surface-border)] px-4 py-3">
        {loadingSessions ? (
          <p className="text-xs text-[color:var(--surface-muted)]">출석 세션 목록 불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-[color:var(--surface-muted)]">가져올 수 있는 출석 세션이 없습니다.</p>
        ) : (
          <>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-10 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]"
            >
              <option value="">출석 세션 선택</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_date} · {s.title} (출석 {s.attendingCount} · 게스트 {s.guestCount})
                  {importedSessionIds.has(s.id) ? " — 가져옴" : ""}
                </option>
              ))}
            </select>

            {selectedSession && (
              <p className="mt-2 text-[11px] text-[color:var(--surface-muted)]">
                {selectedSession.session_date} · {selectedSession.title} — 출석 {selectedSession.attendingCount}명 ·
                게스트 {selectedSession.guestCount}명
                {importedSessionIds.has(selectedSession.id) && " · 이미 이 경기로 가져온 세션입니다(재실행 가능)"}
              </p>
            )}

            <button
              type="button"
              disabled={!selectedId || importing}
              onClick={() => setConfirmOpen(true)}
              className="mt-3 w-full rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
            >
              {importing ? "가져오는 중..." : "출석 명단 가져오기"}
            </button>
          </>
        )}

        {lastResult && (
          <div className="mt-3 rounded-[10px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">가져오기 결과</p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-[color:var(--surface-text)]">
              {RESULT_LABELS.map(({ key, label }) => (
                <div key={key} className="flex justify-between">
                  <span className="text-[color:var(--surface-muted)]">{label}</span>
                  <span className="font-semibold">{lastResult[key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="출석 명단을 가져올까요?"
        description="선택한 출석 세션의 출석 회원과 게스트를 이 경기의 참가자 명단으로 가져옵니다. 이미 참가 중이거나 제외된 인원은 자동으로 건드리지 않습니다."
        confirmLabel="가져오기"
        onConfirm={() => {
          setConfirmOpen(false);
          handleImport();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
