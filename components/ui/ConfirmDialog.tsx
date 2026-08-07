"use client";

/**
 * ConfirmDialog — window.confirm() 대체용 최소 공용 확인 다이얼로그(0052 Phase 2A-4A).
 *
 * controlled 컴포넌트: open은 호출부가 관리하고, 이 컴포넌트는 내부 상태를
 * 갖지 않는다. promise 기반 imperative API는 만들지 않는다(이 저장소의 다른
 * 컴포넌트들과 동일하게 단순 props 기반). 이번 phase에서 신규 도입하는 Event
 * 참가자 roster의 탈퇴/제외 액션에만 사용한다 — 기존 8곳의 window.confirm()
 * 교체는 이번 scope 밖.
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true면 확인 버튼을 위험 색상(fault)으로 표시 — 탈퇴/제외처럼 되돌리려면 별도 액션이 필요한 경우. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] p-4 shadow-card">
        <h2 className="text-[17px] font-bold leading-snug text-[color:var(--surface-text)]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--surface-muted)]">{description}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-[color:var(--surface-border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--surface-muted)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "rounded-sm border border-fault-400/60 bg-fault-400/10 px-3 py-1.5 text-sm font-semibold text-fault-400"
                : "rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1.5 text-sm font-semibold text-clay-400"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
