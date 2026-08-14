"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SchedulingSnapshot } from "@/components/event/EventSchedulingSection";
import type { MatchSlotMode } from "@/lib/supabase/database.types";

/**
 * EventSlotModeSection — Event 운영 방식(slot_mode) 설정(0063, 2A-8C).
 *
 * 이 섹션은 slot_mode 하나만 다룬다. Court·Session·Game을 만들거나 지우지
 * 않고, match_config의 다른 키도 보내지 않는다 — 전용 API가 서버에서 저장된
 * config를 읽어 slot_mode 키만 교체하므로 클라이언트가 config 전체를 들고
 * 있을 필요가 없다.
 *
 * 게이트 정책 — RPC(0063) guard와 정확히 일치시킨다:
 *   - cancelled / completed Event는 read-only (0062 구조 잠금과 같은 경계).
 *   - 현재와 같은 모드는 저장 버튼을 비활성화한다(서버도 no-op이지만
 *     불필요한 요청을 만들지 않는다).
 *   - 활성 슬롯이나 슬롯에 배정된 게임이 있으면 서버가 409로 거부한다.
 *     화면에서도 같은 조건을 미리 안내하되, 최종 판정은 항상 서버다.
 */

interface EventSlotModeSectionProps {
  eventId: string;
  scheduling: SchedulingSnapshot | null;
  loading: boolean;
  /** 변경 후 부모의 refreshAll()만 호출한다 — Event·scheduling·games를 함께 재조회한다. */
  onChanged: () => void | Promise<void>;
}

const MODES: Array<{ value: MatchSlotMode; label: string; description: string }> = [
  {
    value: "none",
    label: "실시간 순차 운영",
    description: "세션 없이 미배치 경기 큐의 순서대로 운영합니다.",
  },
  {
    value: "ordered",
    label: "순서형 슬롯 운영",
    description: "코트별 순서 슬롯을 만들고 게임을 배정합니다. 시간 입력은 사용하지 않습니다.",
  },
  {
    value: "timed",
    label: "시간형 슬롯 운영",
    description: "코트별 시작·종료 시간이 있는 슬롯을 만들고 게임을 배정합니다.",
  },
];

export function EventSlotModeSection({
  eventId,
  scheduling,
  loading,
  onChanged,
}: EventSlotModeSectionProps) {
  const [selected, setSelected] = useState<MatchSlotMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MatchSlotMode | null>(null);
  /**
   * busy state만으로는 같은 tick에 들어온 두 번째 호출을 막지 못한다 —
   * setBusy(true)가 리렌더 전이라 두 호출 모두 busy=false를 읽고 통과한다.
   * 요청 시작 시점에 동기적으로 세워지는 ref를 실제 게이트로 쓴다
   * (EventGamesSection에서 확립한 패턴).
   */
  const mutationLockRef = useRef(false);

  const current = scheduling?.event.slotMode ?? null;
  const isCancelled = scheduling?.event.isCancelled ?? false;
  const isCompleted = scheduling?.event.isCompleted ?? false;
  const readOnly = isCancelled || isCompleted;

  /** 서버가 차단하는 두 조건을 화면에서도 미리 계산한다(최종 판정은 서버). */
  const activeSessionCount = useMemo(
    () =>
      (scheduling?.courts ?? []).reduce(
        (n, c) => n + c.sessions.filter((s) => s.is_active).length,
        0
      ),
    [scheduling]
  );

  const blockedReason = readOnly
    ? isCancelled
      ? "취소된 이벤트는 운영 방식을 변경할 수 없습니다."
      : "완료된 이벤트는 운영 방식을 변경할 수 없습니다. 상태를 진행 중으로 되돌린 뒤 변경해주세요."
    : activeSessionCount > 0
      ? `활성 슬롯이 ${activeSessionCount}개 있어 변경할 수 없습니다. 슬롯을 먼저 비활성화해 주세요.`
      : null;

  const pending = selected ?? current;
  const canSave = !readOnly && !busy && pending !== null && pending !== current;

  async function handleSave(next: MatchSlotMode) {
    // fetch 직전에 동기적으로 잠근다 — ConfirmDialog를 여는 시점이 아니다.
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/slot-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMode: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "운영 방식 변경에 실패했습니다.");
        return;
      }
      if (body?.changed === false) {
        toast.success("이미 같은 운영 방식입니다.");
      } else {
        toast.success("운영 방식이 변경되었습니다. 스케줄 확정은 해제되었습니다.");
      }
      setSelected(null);
      await onChanged();
    } catch {
      toast.error("운영 방식 변경에 실패했습니다.");
    } finally {
      mutationLockRef.current = false;
      setBusy(false);
    }
  }

  if (loading || !scheduling) {
    return (
      <div>
        <h2 className="mb-2 text-[13px] font-bold text-[color:var(--surface-text)]">운영 방식</h2>
        <p className="text-sm text-[color:var(--surface-muted)]">운영 방식을 불러오는 중...</p>
      </div>
    );
  }

  const currentMeta = MODES.find((m) => m.value === current);
  const nextMeta = confirmTarget ? (MODES.find((m) => m.value === confirmTarget) ?? null) : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[color:var(--surface-text)]">운영 방식</h2>
        <span className="text-[10px] text-[color:var(--surface-muted)]">
          현재 {currentMeta?.label ?? current ?? "—"}
        </span>
      </div>

      {blockedReason && (
        <p className="mb-3 rounded-[10px] border border-[color:var(--surface-border)] px-3 py-2 text-xs text-[color:var(--surface-muted)]">
          {blockedReason}
        </p>
      )}

      <div className="space-y-2">
        {MODES.map((m) => {
          const isCurrent = m.value === current;
          const isPicked = pending === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={readOnly || busy}
              onClick={() => setSelected(m.value)}
              className={`w-full rounded-[12px] border px-3 py-2.5 text-left disabled:opacity-60 ${
                isPicked
                  ? "border-[color:var(--admin-accent)]"
                  : "border-[color:var(--surface-border)]"
              }`}
              style={isPicked ? { background: "var(--admin-accent-soft)" } : undefined}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="text-[13px] font-semibold"
                  style={{
                    color: isPicked ? "var(--admin-accent)" : "var(--surface-text)",
                  }}
                >
                  {m.label}
                </span>
                {isCurrent && (
                  <span className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                    현재
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--surface-muted)]">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (pending && pending !== current) setConfirmTarget(pending);
            }}
            className="flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              borderColor: "var(--admin-accent)",
              background: "var(--admin-accent-soft)",
              color: "var(--admin-accent)",
            }}
          >
            {busy ? "변경 중..." : "운영 방식 저장"}
          </button>
          {selected !== null && selected !== current && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
              className="rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-2 text-sm font-semibold text-[color:var(--surface-muted)] disabled:opacity-50"
            >
              되돌리기
            </button>
          )}
        </div>
      )}

      {!readOnly && pending === current && (
        <p className="mt-2 text-[11px] text-[color:var(--surface-muted)]">
          현재와 같은 운영 방식입니다 — 다른 방식을 선택하면 저장할 수 있습니다.
        </p>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="운영 방식을 변경할까요?"
        description={
          nextMeta === null
            ? ""
            : `${currentMeta?.label ?? current} → ${nextMeta.label}로 바꿉니다. ` +
              "참가자 확정은 그대로 유지되고, 코트와 게임도 삭제되지 않습니다. " +
              "다만 스케줄 확정은 해제되어 다시 확정해야 합니다. " +
              "활성 슬롯이나 슬롯에 배정된 게임이 있으면 변경할 수 없습니다."
        }
        confirmLabel="운영 방식 변경"
        onConfirm={() => {
          const target = confirmTarget;
          setConfirmTarget(null);
          if (target) handleSave(target);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
