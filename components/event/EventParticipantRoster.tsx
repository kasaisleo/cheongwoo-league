"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddEventParticipantSection } from "@/components/event/AddEventParticipantSection";
import type { EventParticipant, EventStatus, ParticipantStatus } from "@/lib/supabase/database.types";

interface EventParticipantRosterProps {
  eventId: string;
  eventStatus: EventStatus;
  participants: EventParticipant[];
  loading: boolean;
  /** roster/Event 상세를 함께 재조회하는 부모의 단일 refresh — participants_confirmed_at
   * 동기화를 위해 이 컴포넌트가 직접 참가자만 재조회하지 않는다(2A-4B). */
  onChanged: () => void;
}

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  pending: "확정 대기",
  confirmed: "참가 확정",
  withdrawn: "참가 취소",
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
  { key: "pending", label: "확정 대기" },
  { key: "confirmed", label: "참가 확정" },
  { key: "withdrawn", label: "참가 취소" },
  { key: "excluded", label: "제외" },
];

/**
 * EventParticipantRoster — 참가자 roster 섹션(0052 Phase 2A-4A/2A-4B).
 *
 * participants/loading은 부모(EventDetailPageClient)가 소유한다 — 이 컴포넌트가
 * 직접 GET하지 않는다. 어떤 변경이든(추가/취소/제외/제외해제) 성공 후에는
 * onChanged()만 호출해 부모가 roster+Event를 함께 재조회하게 한다(2A-4B 보정 사항 —
 * participants_confirmed_at은 roster 응답에 없는 별도 데이터라 단독 재조회로는
 * 동기화되지 않는다).
 *
 * "확정"(confirmed)으로의 수동 전환 버튼은 의도적으로 없다 — roster 단위
 * 확정은 ConfirmEventParticipantsSection(confirm_event_participants RPC)의 몫이다.
 * completed/cancelled 이벤트는 추가/상태변경 버튼을 전부 숨긴다 — 최종 방어선은
 * API/RPC의 EVENT_STRUCTURE_LOCKED이고, 이 숨김은 UX일 뿐이다.
 */
export function EventParticipantRoster({
  eventId,
  eventStatus,
  participants,
  loading,
  onChanged,
}: EventParticipantRosterProps) {
  const [filter, setFilter] = useState<ParticipantStatus | "all">("all");
  const [pendingAction, setPendingAction] = useState<{
    participant: EventParticipant;
    nextStatus: "withdrawn" | "excluded";
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 0058: create/update_event_participant는 cancelled에서만 차단된다.
  // completed Event의 명단 변경은 DB가 허용하므로 UI도 막지 않는다.
  // (활성 게임에 배정된 참가자의 비활성화는 DB가 EVENT_PARTICIPANT_IN_ACTIVE_GAME으로
  //  개별 차단하고, 그 메시지를 그대로 노출한다 — UI가 미리 판단하지 않는다.)
  const locked = eventStatus === "cancelled";

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
    if (busyId) return; // 동일 요청 연속 클릭 방지
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
    onChanged();
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
          취소된 경기입니다 — 참가자 명단이 잠겨 있습니다.
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
                        참가 취소
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => requestDestructive(p, "excluded")}
                        className="rounded-sm border border-fault-400/60 px-2 py-1 text-[10px] font-semibold text-fault-400 disabled:opacity-40"
                      >
                        제외
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
          onAdded={onChanged}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.nextStatus === "excluded"
            ? `${pendingAction.participant.display_name_snapshot}님을 제외할까요?`
            : `${pendingAction?.participant.display_name_snapshot}님의 참가를 취소할까요?`
        }
        description={
          pendingAction?.nextStatus === "excluded"
            ? "제외된 참가자는 자동으로 다시 추가되지 않습니다. 나중에 명단에서 직접 제외를 해제해야 합니다."
            : "참가 취소 후에는 참가자 추가 화면에서 다시 추가하면 복구됩니다."
        }
        confirmLabel={pendingAction?.nextStatus === "excluded" ? "제외" : "참가 취소"}
        danger
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
