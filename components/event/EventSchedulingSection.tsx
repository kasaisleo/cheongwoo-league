"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { EventCourt, EventSession, MatchSlotMode } from "@/lib/supabase/database.types";

/**
 * EventSchedulingSection — 코트/세션 관리(0051, Phase 2A-5B).
 *
 * 스케줄 확정(scheduling_confirmed_at)과 대진 생성은 이 phase 범위 밖이다.
 * 세션의 코트 간 이동 UI도 만들지 않는다 — update_event_session에 코트
 * 변경 인자가 없다(0051 RPC 계약 그대로, 후속 migration이 필요한 별도 기능).
 * slotModeLabel/canConfirmScheduling은 표시 편의용 계산값일 뿐이며, 이 컴포넌트
 * 는 이 값으로 권한이나 최종 유효성을 판단하지 않는다 — 모든 쓰기는 API 응답을
 * 그대로 신뢰하고, 최종 방어는 항상 서버(RPC)다.
 */

interface SchedulingCourt extends EventCourt {
  sessions: EventSession[];
}

export interface SchedulingSnapshot {
  event: {
    id: string;
    status: string;
    participants_confirmed_at: string | null;
    scheduling_confirmed_at: string | null;
    slotMode: MatchSlotMode;
    slotModeLabel: string;
    /** 0058 이후 Event 전체 운영 잠금은 cancelled 하나뿐이다. */
    isCancelled: boolean;
    /** 운영상 종료 표시일 뿐 잠금이 아니다 — 결과·구조 변경은 각 RPC guard가 판정한다. */
    isCompleted: boolean;
    canConfirmScheduling: boolean;
  };
  courts: SchedulingCourt[];
}

interface EventSchedulingSectionProps {
  eventId: string;
  scheduling: SchedulingSnapshot | null;
  loading: boolean;
  /** 코트/세션 변경 후 부모의 refreshAll()만 호출한다 — 이 컴포넌트가 직접 재조회하지 않는다. */
  onChanged: () => void;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 문자열(브라우저 로컬 시각)을 ISO(UTC) 문자열로 변환. 빈 값/파싱 실패는 null. */
function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatSessionTime(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  const start = new Date(startsAt).toLocaleString("ko-KR", opts);
  const end = new Date(endsAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${start} ~ ${end}`;
}

const inputCls =
  "h-9 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";
const smallBtnCls =
  "rounded-sm border px-2 py-1 text-[10px] font-semibold disabled:opacity-40";

type PostResult = { ok: true; id?: string } | { ok: false; error: string };

async function postJson(url: string, method: string, body?: unknown): Promise<PostResult> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: responseBody?.error ?? "요청에 실패했습니다." };
  }
  return { ok: true, id: responseBody?.id };
}

export function EventSchedulingSection({ eventId, scheduling, loading, onChanged }: EventSchedulingSectionProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedCourtIds, setExpandedCourtIds] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [addCourtOpen, setAddCourtOpen] = useState(false);
  const [addCourtName, setAddCourtName] = useState("");
  const [openSessionFormCourtId, setOpenSessionFormCourtId] = useState<string | null>(null);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deactivateCourt, setDeactivateCourt] = useState<SchedulingCourt | null>(null);
  const [deactivateSession, setDeactivateSession] = useState<EventSession | null>(null);

  // 재조회 결과에서 사라진 id에 해당하는 로컬 상태만 정리(정책 7) — courts/sessions는
  // 물리 삭제가 없어 실무에서는 거의 트리거되지 않지만, 방어적으로 유지한다.
  useEffect(() => {
    const courtIds = new Set((scheduling?.courts ?? []).map((c) => c.id));
    const sessionIds = new Set((scheduling?.courts ?? []).flatMap((c) => c.sessions.map((s) => s.id)));
    setExpandedCourtIds((prev) => new Set([...prev].filter((id) => courtIds.has(id))));
    setOpenSessionFormCourtId((prev) => (prev && courtIds.has(prev) ? prev : null));
    setEditingCourtId((prev) => (prev && courtIds.has(prev) ? prev : null));
    setEditingSessionId((prev) => (prev && sessionIds.has(prev) ? prev : null));
  }, [scheduling]);

  if (loading) {
    return <p className="text-sm text-[color:var(--surface-muted)]">코트/슬롯 불러오는 중...</p>;
  }
  if (!scheduling) {
    return null;
  }

  const { event, courts } = scheduling;
  // 0058: 코트·슬롯 RPC 6종은 cancelled에서만 EVENT_STRUCTURE_LOCKED를 던진다.
  // completed Event의 코트·슬롯 변경은 DB가 허용하므로 UI도 막지 않는다.
  const locked = event.isCancelled;
  const slotMode = event.slotMode;
  const activeCourts = courts.filter((c) => c.is_active).sort((a, b) => a.position - b.position);
  const inactiveCourts = courts.filter((c) => !c.is_active).sort((a, b) => a.position - b.position);

  function toggleExpanded(courtId: string) {
    setExpandedCourtIds((prev) => {
      const next = new Set(prev);
      if (next.has(courtId)) next.delete(courtId);
      else next.add(courtId);
      return next;
    });
  }

  async function handleAddCourt() {
    const name = addCourtName.trim();
    if (!name) {
      toast.error("코트 이름을 입력해주세요.");
      return;
    }
    if (busyKey) return;
    setBusyKey("court:create");
    const result = await postJson(`/api/admin/events/${eventId}/courts`, "POST", { name });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("코트가 추가되었습니다.");
    setAddCourtName("");
    setAddCourtOpen(false);
    onChanged();
  }

  async function handleRenameCourt(courtId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("코트 이름을 입력해주세요.");
      return;
    }
    if (busyKey) return;
    setBusyKey(`court:update:${courtId}`);
    const result = await postJson(`/api/admin/events/${eventId}/courts/${courtId}`, "PATCH", { name: trimmed });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("코트 이름이 수정되었습니다.");
    setEditingCourtId(null);
    onChanged();
  }

  async function handleSetCourtActive(court: SchedulingCourt, isActive: boolean) {
    if (busyKey) return;
    setBusyKey(`court:update:${court.id}`);
    const result = await postJson(`/api/admin/events/${eventId}/courts/${court.id}`, "PATCH", { isActive });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? "코트가 다시 활성화되었습니다." : "코트가 비활성화되었습니다.");
    onChanged();
  }

  async function handleMoveCourt(courtId: string, direction: "up" | "down") {
    if (busyKey) return;
    const idx = activeCourts.findIndex((c) => c.id === courtId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= activeCourts.length) return;
    const reordered = [...activeCourts];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setBusyKey("court:reorder");
    const result = await postJson(`/api/admin/events/${eventId}/courts/reorder`, "POST", {
      courtIds: reordered.map((c) => c.id),
    });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChanged();
  }

  async function handleAddSession(
    courtId: string,
    input: { startsAt: string | null; endsAt: string | null; label: string }
  ) {
    if (busyKey) return;
    setBusyKey(`session:create:${courtId}`);
    const result = await postJson(`/api/admin/events/${eventId}/courts/${courtId}/sessions`, "POST", {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      label: input.label.trim() || null,
    });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("슬롯이 추가되었습니다.");
    setOpenSessionFormCourtId(null);
    onChanged();
  }

  async function handleEditSession(
    sessionId: string,
    input: { startsAt: string | null; endsAt: string | null; label: string }
  ) {
    if (busyKey) return;
    setBusyKey(`session:update:${sessionId}`);
    const result = await postJson(`/api/admin/events/${eventId}/sessions/${sessionId}`, "PATCH", {
      startsAt: input.startsAt ?? undefined,
      endsAt: input.endsAt ?? undefined,
      clearTimes: slotMode === "ordered" ? true : undefined,
      label: input.label.trim() ? input.label.trim() : undefined,
      clearLabel: input.label.trim() ? undefined : true,
    });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("슬롯이 수정되었습니다.");
    setEditingSessionId(null);
    onChanged();
  }

  async function handleSetSessionActive(session: EventSession, isActive: boolean) {
    if (busyKey) return;
    setBusyKey(`session:update:${session.id}`);
    const result = await postJson(`/api/admin/events/${eventId}/sessions/${session.id}`, "PATCH", { isActive });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? "슬롯이 다시 활성화되었습니다." : "슬롯이 비활성화되었습니다.");
    onChanged();
  }

  async function handleMoveSession(court: SchedulingCourt, sessionId: string, direction: "up" | "down") {
    if (busyKey) return;
    const activeSessions = court.sessions.filter((s) => s.is_active).sort((a, b) => a.position - b.position);
    const idx = activeSessions.findIndex((s) => s.id === sessionId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= activeSessions.length) return;
    const reordered = [...activeSessions];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setBusyKey(`session:reorder:${court.id}`);
    const result = await postJson(`/api/admin/events/${eventId}/courts/${court.id}/sessions/reorder`, "POST", {
      sessionIds: reordered.map((s) => s.id),
    });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChanged();
  }

  function renderCourtCard(court: SchedulingCourt, isInactiveGroup: boolean) {
    const activeSessions = court.sessions.filter((s) => s.is_active).sort((a, b) => a.position - b.position);
    const inactiveSessions = court.sessions.filter((s) => !s.is_active).sort((a, b) => a.position - b.position);
    const expanded = expandedCourtIds.has(court.id);
    const isEditingName = editingCourtId === court.id;

    return (
      <div
        key={court.id}
        className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)]"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          {!isInactiveGroup && !locked && (
            <div className="flex flex-shrink-0 flex-col gap-0.5">
              <button
                type="button"
                disabled={busyKey !== null || court.position === activeCourts[0]?.position}
                onClick={() => handleMoveCourt(court.id, "up")}
                className="text-[10px] leading-none text-[color:var(--surface-muted)] disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={busyKey !== null || court.position === activeCourts[activeCourts.length - 1]?.position}
                onClick={() => handleMoveCourt(court.id, "down")}
                className="text-[10px] leading-none text-[color:var(--surface-muted)] disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <RenameCourtForm
                initialName={court.name}
                busy={busyKey === `court:update:${court.id}`}
                onSave={(name) => handleRenameCourt(court.id, name)}
                onCancel={() => setEditingCourtId(null)}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">
                  {court.name}
                </p>
                {!court.is_active && (
                  <span className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--surface-muted)]">
                    비활성
                  </span>
                )}
              </div>
            )}
            {slotMode !== "none" && (
              <p className="mt-0.5 text-[11px] text-[color:var(--surface-muted)]">
                활성 슬롯 {activeSessions.length}개
                {inactiveSessions.length > 0 && ` · 비활성 슬롯 ${inactiveSessions.length}개`}
              </p>
            )}
          </div>

          {!isEditingName && !locked && (
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {court.is_active ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingCourtId(court.id)}
                    className={`${smallBtnCls} border-[color:var(--surface-border)] text-[color:var(--surface-muted)]`}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => setDeactivateCourt(court)}
                    className={`${smallBtnCls} border-fault-400/60 text-fault-400`}
                  >
                    비활성화
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => handleSetCourtActive(court, true)}
                  className={`${smallBtnCls} border-clay-400/60 bg-clay-400/10 text-clay-400`}
                >
                  {busyKey === `court:update:${court.id}` ? "..." : "재활성화"}
                </button>
              )}
            </div>
          )}

          {slotMode !== "none" && (
            <button
              type="button"
              onClick={() => toggleExpanded(court.id)}
              className="flex-shrink-0 text-[10px] text-[color:var(--surface-muted)]"
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>

        {slotMode !== "none" && expanded && (
          <div className="border-t border-[color:var(--surface-border)] px-4 py-3">
            {activeSessions.length === 0 ? (
              <p className="text-xs text-[color:var(--surface-muted)]">등록된 슬롯이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    slotMode={slotMode}
                    locked={locked}
                    courtActive={court.is_active}
                    isFirst={s.id === activeSessions[0]?.id}
                    isLast={s.id === activeSessions[activeSessions.length - 1]?.id}
                    editing={editingSessionId === s.id}
                    busy={busyKey === `session:update:${s.id}`}
                    onStartEdit={() => setEditingSessionId(s.id)}
                    onCancelEdit={() => setEditingSessionId(null)}
                    onSave={(input) => handleEditSession(s.id, input)}
                    onMove={(dir) => handleMoveSession(court, s.id, dir)}
                    onDeactivate={() => setDeactivateSession(s)}
                    onReactivate={() => handleSetSessionActive(s, true)}
                  />
                ))}
              </div>
            )}

            {inactiveSessions.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-[color:var(--surface-muted)]">
                  비활성 슬롯 {inactiveSessions.length}개
                </summary>
                <div className="mt-2 space-y-2">
                  {inactiveSessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      slotMode={slotMode}
                      locked={locked}
                      courtActive={court.is_active}
                      isFirst
                      isLast
                      editing={false}
                      busy={busyKey === `session:update:${s.id}`}
                      onStartEdit={() => {}}
                      onCancelEdit={() => {}}
                      onSave={() => {}}
                      onMove={() => {}}
                      onDeactivate={() => {}}
                      onReactivate={() => handleSetSessionActive(s, true)}
                    />
                  ))}
                </div>
              </details>
            )}

            {court.is_active && !locked && (
              <div className="mt-3">
                {openSessionFormCourtId === court.id ? (
                  <AddSessionForm
                    slotMode={slotMode}
                    busy={busyKey === `session:create:${court.id}`}
                    onSubmit={(input) => handleAddSession(court.id, input)}
                    onCancel={() => setOpenSessionFormCourtId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenSessionFormCourtId(court.id)}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[10px] font-semibold text-clay-400"
                  >
                    + 슬롯 추가
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[color:var(--surface-text)]">코트 및 슬롯</h2>
        <span className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
          {event.slotModeLabel}
        </span>
      </div>

      {locked && (
        <div className="mb-3 rounded-[10px] border border-fault-400/40 bg-fault-400/10 px-3 py-2 text-xs font-semibold text-fault-400">
          취소된 경기입니다 — 코트/슬롯이 잠겨 있습니다.
        </div>
      )}

      {slotMode === "none" && (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">
          실시간 순차 운영에서는 별도의 슬롯을 만들지 않습니다.
        </p>
      )}

      {!event.canConfirmScheduling && !locked && (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">
          참가자 명단 확정 전에도 코트와 시간을 미리 설정할 수 있습니다.
        </p>
      )}

      <div className="mb-3 space-y-2">
        {activeCourts.length === 0 ? (
          <p className="rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3 text-sm text-[color:var(--surface-muted)]">
            등록된 코트가 없습니다.
          </p>
        ) : (
          activeCourts.map((c) => renderCourtCard(c, false))
        )}
      </div>

      {!locked && (
        <div className="mb-3">
          {addCourtOpen ? (
            <div className="flex gap-2 rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] p-3">
              <input
                autoFocus
                value={addCourtName}
                onChange={(e) => setAddCourtName(e.target.value)}
                placeholder="코트 이름 (예: 코트 1)"
                maxLength={40}
                className={inputCls}
              />
              <button
                type="button"
                disabled={busyKey === "court:create"}
                onClick={handleAddCourt}
                className="flex-shrink-0 rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 text-xs font-semibold text-clay-400 disabled:opacity-40"
              >
                {busyKey === "court:create" ? "..." : "추가"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddCourtOpen(false);
                  setAddCourtName("");
                }}
                className="flex-shrink-0 rounded-sm border border-[color:var(--surface-border)] px-3 text-xs font-semibold text-[color:var(--surface-muted)]"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddCourtOpen(true)}
              className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1.5 text-xs font-semibold text-clay-400"
            >
              + 코트 추가
            </button>
          )}
        </div>
      )}

      {inactiveCourts.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-[11px] font-semibold text-[color:var(--surface-muted)]"
          >
            {showInactive ? "▲" : "▼"} 비활성 코트 및 슬롯 ({inactiveCourts.length})
          </button>
          {showInactive && (
            <div className="mt-2 space-y-2">{inactiveCourts.map((c) => renderCourtCard(c, true))}</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deactivateCourt !== null}
        title={`${deactivateCourt?.name} 코트를 비활성화할까요?`}
        description="이 코트를 사용 중인 활성 슬롯이 있으면 비활성화할 수 없습니다. 필요하면 나중에 다시 활성화할 수 있습니다."
        confirmLabel="비활성화"
        danger
        onConfirm={() => {
          const court = deactivateCourt!;
          setDeactivateCourt(null);
          handleSetCourtActive(court, false);
        }}
        onCancel={() => setDeactivateCourt(null)}
      />

      <ConfirmDialog
        open={deactivateSession !== null}
        title="이 슬롯을 비활성화할까요?"
        description="비활성화된 슬롯은 나중에 다시 활성화할 수 있습니다."
        confirmLabel="비활성화"
        danger
        onConfirm={() => {
          const session = deactivateSession!;
          setDeactivateSession(null);
          handleSetSessionActive(session, false);
        }}
        onCancel={() => setDeactivateSession(null)}
      />
    </div>
  );
}

function RenameCourtForm({
  initialName,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="flex gap-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className={`${inputCls} h-8`}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(name)}
        className="flex-shrink-0 rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 text-[11px] font-semibold text-clay-400 disabled:opacity-40"
      >
        {busy ? "..." : "저장"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-shrink-0 rounded-sm border border-[color:var(--surface-border)] px-2 text-[11px] font-semibold text-[color:var(--surface-muted)]"
      >
        취소
      </button>
    </div>
  );
}

interface SessionRowProps {
  session: EventSession;
  slotMode: MatchSlotMode;
  locked: boolean;
  courtActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  busy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: { startsAt: string | null; endsAt: string | null; label: string }) => void;
  onMove: (direction: "up" | "down") => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

function SessionRow({
  session,
  slotMode,
  locked,
  courtActive,
  isFirst,
  isLast,
  editing,
  busy,
  onStartEdit,
  onCancelEdit,
  onSave,
  onMove,
  onDeactivate,
  onReactivate,
}: SessionRowProps) {
  if (editing) {
    return (
      <div className="rounded-[10px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-3">
        <SessionFieldsForm
          slotMode={slotMode}
          initialStartsAt={session.starts_at}
          initialEndsAt={session.ends_at}
          initialLabel={session.label ?? ""}
          busy={busy}
          submitLabel="저장"
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] px-3 py-2">
      {session.is_active && !locked && (
        <div className="flex flex-shrink-0 flex-col gap-0.5">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove("up")}
            className="text-[9px] leading-none text-[color:var(--surface-muted)] disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove("down")}
            className="text-[9px] leading-none text-[color:var(--surface-muted)] disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[color:var(--surface-text)]">
          {slotMode === "timed" ? formatSessionTime(session.starts_at, session.ends_at) : `순번 ${session.position}`}
          {session.label && <span className="ml-1.5 text-[11px] text-[color:var(--surface-muted)]">{session.label}</span>}
        </p>
      </div>
      {!locked && (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {session.is_active ? (
            <>
              <button type="button" onClick={onStartEdit} className={`${smallBtnCls} border-[color:var(--surface-border)] text-[color:var(--surface-muted)]`}>
                수정
              </button>
              <button type="button" disabled={busy} onClick={onDeactivate} className={`${smallBtnCls} border-fault-400/60 text-fault-400`}>
                비활성화
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !courtActive}
              title={!courtActive ? "코트가 비활성 상태라 재활성화할 수 없습니다." : undefined}
              onClick={onReactivate}
              className={`${smallBtnCls} border-clay-400/60 bg-clay-400/10 text-clay-400`}
            >
              {busy ? "..." : "재활성화"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SessionFieldsFormProps {
  slotMode: MatchSlotMode;
  initialStartsAt: string | null;
  initialEndsAt: string | null;
  initialLabel: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: { startsAt: string | null; endsAt: string | null; label: string }) => void;
  onCancel: () => void;
}

/** slot_mode별 필드만 노출한다 — none은 이 폼 자체가 호출되지 않는다, ordered는 시간 필드 숨김, timed는 시간 필드 필수. */
function SessionFieldsForm({
  slotMode,
  initialStartsAt,
  initialEndsAt,
  initialLabel,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: SessionFieldsFormProps) {
  const [startsAtLocal, setStartsAtLocal] = useState(toDatetimeLocalValue(initialStartsAt));
  const [endsAtLocal, setEndsAtLocal] = useState(toDatetimeLocalValue(initialEndsAt));
  const [label, setLabel] = useState(initialLabel);

  function handleSubmit() {
    if (slotMode === "timed") {
      if (!startsAtLocal || !endsAtLocal) {
        toast.error("시작 시각과 종료 시각을 모두 입력해주세요.");
        return;
      }
      const startsAt = fromDatetimeLocalValue(startsAtLocal);
      const endsAt = fromDatetimeLocalValue(endsAtLocal);
      if (!startsAt || !endsAt) {
        toast.error("올바르지 않은 날짜/시각입니다.");
        return;
      }
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        toast.error("종료 시각은 시작 시각보다 늦어야 합니다.");
        return;
      }
      onSubmit({ startsAt, endsAt, label });
      return;
    }
    // ordered: 시간 필드 없음
    onSubmit({ startsAt: null, endsAt: null, label });
  }

  return (
    <div className="space-y-2">
      {slotMode === "timed" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="datetime-local"
            value={startsAtLocal}
            onChange={(e) => setStartsAtLocal(e.target.value)}
            className={`${inputCls} h-8 min-w-0 w-full`}
          />
          <input
            type="datetime-local"
            value={endsAtLocal}
            onChange={(e) => setEndsAtLocal(e.target.value)}
            className={`${inputCls} h-8 min-w-0 w-full`}
          />
        </div>
      )}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="라벨 (선택)"
        maxLength={60}
        className={`${inputCls} h-8`}
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={handleSubmit}
          className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1 text-[11px] font-semibold text-clay-400 disabled:opacity-40"
        >
          {busy ? "..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-[color:var(--surface-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--surface-muted)]"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function AddSessionForm({
  slotMode,
  busy,
  onSubmit,
  onCancel,
}: {
  slotMode: MatchSlotMode;
  busy: boolean;
  onSubmit: (input: { startsAt: string | null; endsAt: string | null; label: string }) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[10px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-3">
      <SessionFieldsForm
        slotMode={slotMode}
        initialStartsAt={null}
        initialEndsAt={null}
        initialLabel=""
        busy={busy}
        submitLabel="추가"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}
