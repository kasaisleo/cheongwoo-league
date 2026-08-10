"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { toast } from "@/components/ui/Toast";
import { EventParticipantRoster } from "@/components/event/EventParticipantRoster";
import { ImportAttendanceParticipantsSection } from "@/components/event/ImportAttendanceParticipantsSection";
import { ConfirmEventParticipantsSection } from "@/components/event/ConfirmEventParticipantsSection";
import type { Event, EventParticipant, EventStatus } from "@/lib/supabase/database.types";

interface EventDetailPageClientProps {
  eventId: string;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "초안",
  active: "진행중",
  completed: "완료",
  cancelled: "취소",
};

/**
 * update_event(0050)의 상태 전이표를 그대로 복제한다 — 여기서 막지 않은
 * 값을 보내도 RPC가 최종 방어선으로 다시 검증한다(EVENT_STATUS_TERMINAL/
 * INVALID_STATUS_TRANSITION → lib/event-engine.ts가 409로 매핑).
 */
function nextStatusOptions(current: EventStatus): EventStatus[] {
  switch (current) {
    case "draft":
      return ["draft", "active", "completed", "cancelled"];
    case "active":
      return ["active", "completed", "cancelled"];
    case "completed":
      return ["completed", "active"];
    case "cancelled":
      return ["cancelled"];
  }
}

export function EventDetailPageClient({ eventId }: EventDetailPageClientProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<EventStatus>("draft");
  const [saving, setSaving] = useState(false);

  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Event 상세와 participants_confirmed_at은 roster 응답과는 별개 데이터라(2A-4B
  // 보정 사항) 항상 이 함수로 같이 다시 읽는다 — 한쪽만 재조회해서 화면에 stale한
  // 확정 상태가 남거나, 확정 성공 후에도 미확정으로 보이는 문제를 만들지 않는다.
  //
  // loadingEvent는 여기서 건드리지 않는다 — 최초 진입 로딩 전용 플래그이고,
  // mutation 후 refreshAll()의 백그라운드 재조회에서까지 true로 바뀌면 화면
  // 전체가 매번 "불러오는 중..."으로 unmount/remount되어 import 결과 패널·
  // 선택한 세션·roster 필터 등 자식 컴포넌트의 로컬 상태가 전부 날아간다
  // (실사용 QA에서 실측된 버그, 아래 useEffect에서만 최초 1회 관리).
  const loadEvent = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${eventId}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body.event) {
      setEvent(body.event);
      setTitle(body.event.title);
      setEventDate(body.event.event_date);
      setStatus(body.event.status);
    }
  }, [eventId]);

  const loadParticipants = useCallback(async () => {
    setLoadingParticipants(true);
    const res = await fetch(`/api/admin/events/${eventId}/participants`);
    const body = await res.json().catch(() => null);
    setLoadingParticipants(false);
    if (res.ok) setParticipants(body.participants ?? []);
  }, [eventId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadEvent(), loadParticipants()]);
  }, [loadEvent, loadParticipants]);

  useEffect(() => {
    refreshAll().finally(() => setLoadingEvent(false));
  }, [refreshAll]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("이벤트명을 입력해주세요.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), eventDate, status }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      toast.error(body?.error ?? "수정에 실패했습니다.");
      return;
    }
    toast.success("이벤트 정보가 저장되었습니다.");
    await loadEvent();
  }

  if (loadingEvent) {
    return (
      <main className="px-4 pt-6 pb-28">
        <p className="text-sm text-[color:var(--surface-muted)]">불러오는 중...</p>
      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main className="px-4 pt-6 pb-28">
        <AdminPageHeader title="경기 관리" backHref="/admin/events" />
        <p className="text-sm text-[color:var(--surface-muted)]">이벤트를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const inputCls =
    "h-10 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";
  const labelCls = "mb-1.5 block text-xs font-semibold text-[color:var(--surface-muted)]";
  const locked = event.status === "completed" || event.status === "cancelled";

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader title={event.title} description={event.event_date} backHref="/admin/events" />

      <form onSubmit={handleSave} className="mb-6 space-y-4 rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] p-4">
        <div>
          <label className={labelCls}>이벤트명</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>날짜</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)} className={inputCls}>
            {nextStatusOptions(event.status).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[var(--admin-button-radius,6px)] border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>

      {!locked && (
        <div className="mb-6">
          <ImportAttendanceParticipantsSection eventId={event.id} participants={participants} onChanged={refreshAll} />
        </div>
      )}

      <h2 className="mb-2 text-[13px] font-bold text-[color:var(--surface-text)]">참가자 명단</h2>
      <EventParticipantRoster
        eventId={event.id}
        eventStatus={event.status}
        participants={participants}
        loading={loadingParticipants}
        onChanged={refreshAll}
      />

      {!locked && (
        <div className="mt-6">
          <ConfirmEventParticipantsSection
            eventId={event.id}
            participants={participants}
            participantsConfirmedAt={event.participants_confirmed_at}
            onChanged={refreshAll}
          />
        </div>
      )}
    </main>
  );
}
