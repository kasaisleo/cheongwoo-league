"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddEventParticipantSection } from "@/components/event/AddEventParticipantSection";
import type { EventParticipant, EventStatus, ParticipantStatus } from "@/lib/supabase/database.types";

interface EventParticipantRosterProps {
  eventId: string;
  eventStatus: EventStatus;
}

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  pending: "대기",
  confirmed: "확정",
  withdrawn: "탈퇴",
  excluded: "제외",
};

// Tailwind theme 토큰(tailwind.config.ts) 실제 hex값 — CSS 커스텀 프로퍼티가
// 아니라 정적 Tailwind 색상이라 동적 인라인 style에는 리터럴 값을 쓴다
// (AttendanceToggle의 상태별 accent 처리와 동일 패턴).
const STATUS_ACCENT: Record<ParticipantStatus, string> = {
  pending: "#7C92AC", // line-500 (중립)
  confirmed: "#2EA86B", // win DEFAULT
  withdrawn: "#5C7596", // line-400 (중립, 약간 어둡게)
  excluded: "#FF5C72", // fault-400
};

const FILTERS: Array<{ key: ParticipantStatus | "all"; label: string }> = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "confirmed", label: "확정" },
  { key: "withdrawn", label: "탈퇴" },
  { key: "excluded", label: "제외" },
];

/**
 * EventParticipantRoster — event_participants roster 섹션(0052 Phase 2A-4A).
 *
 * pending/confirmed/withdrawn/excluded 표시 + status 필터 + 탈퇴/제외/제외해제.
 * "confirmed"로의 수동 전환 버튼은 의도적으로 없다(2A-4B의 roster 확정 액션 몫).
 * completed/cancelled 이벤트는 추가/상태변경 버튼을 전부 비활성화한다 — 최종
 * 방어선은 API/RPC의 EVENT_STRUCTURE_LOCKED이고, 이 disabled는 UX일 뿐이다.
 */
export function EventParticipantRoster({ eventId, eventStatus }: EventParticipantRosterProps) {
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ParticipantStatus | "all">("all");
  const [pendingAction, setPendingAction] = useState<{
    participant: EventParticipant;
    nextStatus: "withdrawn" | "excluded";
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const locked = eventStatus === "completed" || eventStatus === "cancelled";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}/participants`);
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) setParticipants(body.participants ?? []);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeMemberIds = useMemo(
    () =>
      new Set(
        participants
          .filter((p) => p.participant_type === "member" && p.is_active)
          .map((p) => p.member_id!)
      ),
    [participants]
  );
  const activeGuestIds = useMemo(
    () =>
      new Set(
        participants
          .filter((p) => p.participant_type === "guest" && p.is_active)
          .map((p) => p.guest_id!)
      ),
    [participants]
  );

  const visible = filter === "all" ? participants : participants.filter((p) => p.status === filter);

  const counts = useMemo(() => {
    const c: Record<ParticipantStatus, number> = { pending: 0, confirmed: 0, withdrawn: 0, excluded: 0 };
    for (const p of participants) c[p.status]++;
    return c;
  }, [participants]);

  async function changeStatus(participantId: string, status: ParticipantStatus) {
    setBusyId(participantId);
    const res = await fetch(`/api/admin/events/${eventId}/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      toast.error(body?.error ?? "상태 변경에 실패했습니다.");
      return;
    }
    toast.success("참가자 상태가 변경되었습니다.");
    await load();
  }

  function requestDestructive(participant: EventParticipant, nextStatus: "withdrawn" | "excluded") {
    setPendingAction({ participant, nextStatus });
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const { participant, nextStatus } = pendingAction;
    setPendingAction(null);
    await changeStatus(participant.id, nextStatus);
  }

  return (
    <div>
      {locked && (
        <div className="mb-3 rounded-[10px] border border-fault-400/40 bg-fault-400/10 px-3 py-2 text-xs font-semibold text-fault-400">
          {eventStatus === "completed" ? "완료된" : "취소된"} 이벤트입니다 — 참가자 명단이 잠겨 있습니다.
        </div>
      )}

      {/* 상태 필터 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? "rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400"
                : "rounded-sm border border-[color:var(--surface-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--surface-muted)]"
            }
          >
            {f.label}
            {f.key !== "all" && <span className="ml-1">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {/* roster */}
      <div className="mb-3 overflow-hidden rounded-[14px] border border-[color:var(--surface-border)]">
        {loading ? (
          <p className="px-4 py-3 text-sm text-[color:var(--surface-muted)]">참가자 목록 불러오는 중...</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[color:var(--surface-muted)]">참가자가 없습니다.</p>
        ) : (
          visible.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 border-l-4 border-b border-b-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3 last:border-b-0"
              style={{ borderLeftColor: STATUS_ACCENT[p.status] }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">
                  {p.display_name_snapshot}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--surface-muted)]">
                    {p.participant_type === "member" ? "회원" : "게스트"}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: STATUS_ACCENT[p.status] }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
              </div>

              {!locked && (
                <div className="flex flex-shrink-0 gap-1.5">
                  {(p.status === "pending" || p.status === "confirmed") && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => requestDestructive(p, "withdrawn")}
                        className="rounded-sm border border-[color:var(--surface-border)] px-2 py-1 text-[10px] font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
                      >
                        탈퇴 처리
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => requestDestructive(p, "excluded")}
                        className="rounded-sm border border-fault-400/60 px-2 py-1 text-[10px] font-semibold text-fault-400 disabled:opacity-40"
                      >
                        제외 처리
                      </button>
                    </>
                  )}
                  {p.status === "excluded" && (
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => changeStatus(p.id, "pending")}
                      className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-1 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                    >
                      {busyId === p.id ? "..." : "제외 해제"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!locked && (
        <AddEventParticipantSection
          eventId={eventId}
          activeMemberIds={activeMemberIds}
          activeGuestIds={activeGuestIds}
          onAdded={load}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.nextStatus === "excluded"
            ? `${pendingAction.participant.display_name_snapshot}님을 제외 처리할까요?`
            : `${pendingAction?.participant.display_name_snapshot}님을 탈퇴 처리할까요?`
        }
        description={
          pendingAction?.nextStatus === "excluded"
            ? "제외 처리된 참가자는 자동으로 다시 추가되지 않습니다. 나중에 명단에서 직접 제외를 해제해야 합니다."
            : "탈퇴 처리 후에는 참가자 추가 화면에서 다시 추가하면 복구됩니다."
        }
        confirmLabel={pendingAction?.nextStatus === "excluded" ? "제외 처리" : "탈퇴 처리"}
        danger
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
