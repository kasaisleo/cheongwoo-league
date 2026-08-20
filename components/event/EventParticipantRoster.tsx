"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddEventParticipantSection } from "@/components/event/AddEventParticipantSection";
import type { EventParticipant, EventStatus, ParticipantStatus, Gender, DominantHand } from "@/lib/supabase/database.types";
import { GENDER_LABEL, DOMINANT_HAND_LABEL, GENDERS, DOMINANT_HANDS } from "@/lib/player-profile";

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

/** 0074: NULL(아직 굳지 않음)과 unspecified(명시적 미지정)를 select 에서 구분하는 sentinel. */
const NULL_SENTINEL = "__null__";

interface ProfileDraft {
  gender: string;
  tennisStartYear: string;
  dominantHand: string;
}

const EMPTY_DRAFT: ProfileDraft = {
  gender: NULL_SENTINEL,
  tennisStartYear: "",
  dominantHand: NULL_SENTINEL,
};

/** NULL 을 어떻게 부를지는 참가자 종류에 따라 다르다. */
const nullLabel = (isMember: boolean) => (isMember ? "회원 프로필 사용" : "미설정");

const profileInputCls =
  "h-9 w-full rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-2 text-[12px] text-[color:var(--surface-text)]";

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
  /** 0074: participant snapshot 편집. NULL 상태를 sentinel 로 구분한다 —
   *  select value 에 null 을 넣을 수 없고, "아직 굳지 않음"과 "명시적 미지정"은
   *  의미가 다르기 때문이다. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);

  // 0058: create/update_event_participant는 cancelled에서만 차단된다.
  // completed Event의 명단 변경은 DB가 허용하므로 UI도 막지 않는다.
  // (활성 게임에 배정된 참가자의 비활성화는 DB가 EVENT_PARTICIPANT_IN_ACTIVE_GAME으로
  //  개별 차단하고, 그 메시지를 그대로 노출한다 — UI가 미리 판단하지 않는다.)
  const locked = eventStatus === "cancelled";

  // 0074: Profile RPC(set_event_participant_profile)는 completed 도 차단한다.
  // 기존 상태 변경 정책(cancelled 만 잠금)과 다르므로 별도 조건을 둔다 —
  // 저장을 눌렀다가 RPC 오류를 보는 UX 가 되지 않게 버튼을 미리 비활성화한다.
  const profileLocked = eventStatus === "completed" || eventStatus === "cancelled";
  const profileLockMessage =
    eventStatus === "completed"
      ? "완료된 Event의 선수 정보는 수정할 수 없습니다"
      : "취소된 Event의 선수 정보는 수정할 수 없습니다";

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

  function toggleProfile(p: EventParticipant) {
    if (editingId === p.id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      return;
    }
    // 저장된 snapshot 을 그대로 연다 — NULL 은 NULL 상태로 표시하고 임의로
    // unspecified 로 바꾸지 않는다(fallback 의미가 사라지기 때문).
    setDraft({
      gender: p.gender_snapshot ?? NULL_SENTINEL,
      tennisStartYear: p.tennis_start_year_snapshot?.toString() ?? "",
      dominantHand: p.dominant_hand_snapshot ?? NULL_SENTINEL,
    });
    setEditingId(p.id);
  }

  async function saveProfile(participantId: string) {
    if (busyId) return;
    setBusyId(participantId);
    // 세 key 를 항상 보낸다. sentinel 과 빈 입력은 명시적 null 로 변환한다.
    const res = await fetch(
      `/api/admin/events/${eventId}/participants/${participantId}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: draft.gender === NULL_SENTINEL ? null : draft.gender,
          tennisStartYear: draft.tennisStartYear.trim() || null,
          dominantHand: draft.dominantHand === NULL_SENTINEL ? null : draft.dominantHand,
        }),
      }
    );
    const body = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      toast.error(body?.error ?? "참가자 정보 저장에 실패했습니다.");
      return;
    }
    toast.success("참가자 정보를 저장했습니다.");
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    onChanged();
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
              className="border-l-4 border-b border-b-[color:var(--surface-border)] bg-[color:var(--surface-bg)] last:border-b-0"
              style={{ borderLeftColor: STATUS_ACCENT[p.status] }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
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
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => toggleProfile(p)}
                    className="rounded-sm border border-[color:var(--surface-border)] px-2 py-1 text-[10px] font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
                  >
                    {editingId === p.id ? "닫기" : "정보"}
                  </button>
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

                {/* 0074: 자동 대진용 snapshot 편집. 서버(RPC)가 최종 검증이다. */}
                {editingId === p.id && (
                  <div className="border-t border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">성별</span>
                        <select
                          className={profileInputCls}
                          value={draft.gender}
                          onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                        >
                          <option value={NULL_SENTINEL}>{nullLabel(p.participant_type === "member")}</option>
                          {GENDERS.map((g) => (
                            <option key={g} value={g}>{GENDER_LABEL[g]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">주손</span>
                        <select
                          className={profileInputCls}
                          value={draft.dominantHand}
                          onChange={(e) => setDraft({ ...draft, dominantHand: e.target.value })}
                        >
                          <option value={NULL_SENTINEL}>{nullLabel(p.participant_type === "member")}</option>
                          {DOMINANT_HANDS.map((h) => (
                            <option key={h} value={h}>{DOMINANT_HAND_LABEL[h]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">
                          테니스 시작 연도
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1900}
                          max={new Date().getFullYear()}
                          step={1}
                          className={profileInputCls}
                          value={draft.tennisStartYear}
                          onChange={(e) => setDraft({ ...draft, tennisStartYear: e.target.value })}
                          placeholder={nullLabel(p.participant_type === "member")}
                        />
                      </label>
                    </div>
                    {profileLocked && (
                      <p className="mt-2 text-[11px] font-semibold text-fault-400">{profileLockMessage}</p>
                    )}
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }}
                        className="rounded-sm border border-[color:var(--surface-border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || profileLocked}
                        onClick={() => saveProfile(p.id)}
                        className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[11px] font-semibold text-clay-400 disabled:opacity-40"
                      >
                        {busyId === p.id ? "저장 중..." : "저장"}
                      </button>
                    </div>
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
