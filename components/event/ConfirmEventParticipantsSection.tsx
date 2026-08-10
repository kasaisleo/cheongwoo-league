"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { EventParticipant } from "@/lib/supabase/database.types";

interface ConfirmEventParticipantsSectionProps {
  eventId: string;
  participants: EventParticipant[];
  /** events.participants_confirmed_at — Event 재조회로만 얻는 값. 이 컴포넌트가
   * 직접 시각을 만들어 표시하지 않는다(2A-4B 보정 사항). */
  participantsConfirmedAt: string | null;
  onChanged: () => void;
}

/**
 * ConfirmEventParticipantsSection — 참가자 명단 확정(2A-4B, confirm_event_participants).
 *
 * 확정은 구조적 lock이 아니다 — DB 계약상 확정 후에도 추가/취소/제외/제외해제/
 * import가 전부 허용되고, 실제 변경이 생기면 participants_confirmed_at이 다시
 * null이 된다. 이 컴포넌트는 그 어떤 액션도 막지 않고 안내 문구만 보여준다.
 */
export function ConfirmEventParticipantsSection({
  eventId,
  participants,
  participantsConfirmedAt,
  onChanged,
}: ConfirmEventParticipantsSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const activeCount = useMemo(() => participants.filter((p) => p.is_active).length, [participants]);

  async function handleConfirm() {
    if (confirming) return; // 동일 요청 연속 클릭 방지
    setConfirming(true);
    const res = await fetch(`/api/admin/events/${eventId}/participants/confirm`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setConfirming(false);
    if (!res.ok) {
      toast.error(body?.error ?? "참가자 명단 확정에 실패했습니다.");
      return;
    }
    toast.success(
      body.transitionedCount > 0
        ? `${body.transitionedCount}명이 참가 확정으로 전환되었습니다.`
        : "참가자 명단이 확정되었습니다."
    );
    onChanged();
  }

  const confirmedLabel = participantsConfirmedAt
    ? `명단 확정 완료 · ${new Date(participantsConfirmedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "명단 미확정";

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[color:var(--surface-text)]">참가자 명단 확정</p>
          <p className="mt-0.5 text-[11px] text-[color:var(--surface-muted)]">
            현재 참가 인원 {activeCount}명 · {confirmedLabel}
          </p>
          {participantsConfirmedAt && (
            <p className="mt-1 text-[10px] text-[color:var(--surface-muted)]">
              참가자 명단을 변경하면 확정 상태가 해제됩니다.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={activeCount === 0 || confirming}
          onClick={() => setConfirmOpen(true)}
          className="flex-shrink-0 whitespace-nowrap rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
        >
          {confirming ? "확정 중..." : "참가자 명단 확정"}
        </button>
      </div>
      {activeCount === 0 && (
        <p className="mt-2 text-[11px] text-fault-400">참가 중인 인원이 없어 확정할 수 없습니다.</p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="참가자 명단을 확정할까요?"
        description="현재 확정 대기 중인 참가자가 전부 참가 확정으로 전환됩니다. 이후 명단을 변경하면 확정 상태는 자동으로 해제됩니다."
        confirmLabel="확정"
        onConfirm={() => {
          setConfirmOpen(false);
          handleConfirm();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
