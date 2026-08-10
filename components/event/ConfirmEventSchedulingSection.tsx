"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SchedulingSnapshot } from "@/components/event/EventSchedulingSection";

interface ConfirmEventSchedulingSectionProps {
  eventId: string;
  scheduling: SchedulingSnapshot | null;
  /**
   * 코트/슬롯 변경 후 부모의 refreshAll()만 호출한다 — 이 컴포넌트가 직접
   * 재조회하지 않는다. Promise를 반환하면 handleConfirm이 완료를 기다린 뒤에만
   * busy를 해제한다(최신 scheduling snapshot이 반영되기 전에 버튼이 다시
   * 눌리는 것을 막기 위함).
   */
  onChanged: () => void | Promise<void>;
}

/**
 * ConfirmEventSchedulingSection — 스케줄 확정 섹션(0053 Phase 2A-5C).
 *
 * ConfirmEventParticipantsSection과 달리, 확정 완료 후에는 액션 버튼을
 * 계속 노출하지 않는다(정책 확정 사항) — 참가자 확정과 달리 스케줄
 * 확정은 "완료 상태 표시"가 UX의 끝이다. 확정 후 코트·슬롯 또는 참가자
 * 명단이 실질적으로 변경되면 confirm_event_scheduling/코트·슬롯·참가자
 * RPC들이 각자 트랜잭션 안에서 scheduling_confirmed_at을 다시 null로
 * 만들고, 그 결과는 부모의 refreshAll()이 채워주는 scheduling snapshot을
 * 통해 이 컴포넌트에 그대로 반영된다 — 이 컴포넌트가 직접 감지하지 않는다.
 *
 * canConfirmScheduling은 participants_confirmed_at 존재 여부만 반영하는
 * 표시용 힌트다(app/api/admin/events/[id]/scheduling/route.ts 참고) — 활성
 * 코트/슬롯 조건까지는 반영하지 않으므로, 이 힌트가 true라도 실제 확정
 * 시도는 confirm_event_scheduling RPC가 최종 거부할 수 있다(예:
 * EVENT_SCHEDULING_NO_ACTIVE_COURTS). 이 컴포넌트는 그 실패를 toast로만
 * 안내하고, 별도로 미리 판단하려 하지 않는다.
 */
export function ConfirmEventSchedulingSection({ eventId, scheduling, onChanged }: ConfirmEventSchedulingSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!scheduling) return null;

  const { event } = scheduling;
  const schedulingConfirmedAt = event.scheduling_confirmed_at;
  const canConfirm = event.canConfirmScheduling;

  async function handleConfirm() {
    if (confirming) return; // 동일 요청 연속 클릭 방지
    setConfirming(true);
    // busy는 onChanged()(refreshAll)까지 끝난 뒤에만 해제한다 — API 응답 직후
    // 바로 풀면 최신 scheduling snapshot이 반영되기 전의 짧은 틈에 버튼이
    // 다시 활성화될 수 있다(2A-5C QA에서 지적된 P2). API 실패든 onChanged()
    // 실패든 finally에서 항상 풀리도록 try/catch/finally로 감싼다.
    try {
      const res = await fetch(`/api/admin/events/${eventId}/scheduling/confirm`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "스케줄 확정에 실패했습니다.");
        return;
      }
      toast.success("스케줄이 확정되었습니다.");
      await onChanged();
    } catch {
      toast.error("스케줄 확정에 실패했습니다.");
    } finally {
      setConfirming(false);
    }
  }

  const confirmedLabel = schedulingConfirmedAt
    ? `확정 완료 · ${new Date(schedulingConfirmedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "스케줄 미확정";

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[color:var(--surface-text)]">스케줄 확정</p>
          <p className="mt-0.5 text-[11px] text-[color:var(--surface-muted)]">{confirmedLabel}</p>
          <p className="mt-1 text-[10px] text-[color:var(--surface-muted)]">
            코트·슬롯 또는 참가자 명단이 변경되면 스케줄 확정이 해제됩니다.
          </p>
        </div>
        {!schedulingConfirmedAt && (
          <button
            type="button"
            disabled={!canConfirm || confirming}
            onClick={() => setConfirmOpen(true)}
            className="flex-shrink-0 whitespace-nowrap rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
          >
            {confirming ? "확정 중..." : "스케줄 확정"}
          </button>
        )}
      </div>
      {!canConfirm && !schedulingConfirmedAt && (
        <p className="mt-2 text-[11px] text-fault-400">참가자 명단을 먼저 확정해야 스케줄을 확정할 수 있습니다.</p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="스케줄을 확정할까요?"
        description="현재 코트·슬롯 구성으로 스케줄이 확정됩니다. 이후 코트·슬롯 또는 참가자 명단을 변경하면 확정 상태는 자동으로 해제됩니다."
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
