"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { toast } from "@/components/ui/Toast";
import { EventParticipantRoster } from "@/components/event/EventParticipantRoster";
import type { Event, EventStatus } from "@/lib/supabase/database.types";

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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<EventStatus>("draft");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}`);
    if (res.status === 404) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && body.event) {
      setEvent(body.event);
      setTitle(body.event.title);
      setEventDate(body.event.event_date);
      setStatus(body.event.status);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

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
    await load();
  }

  if (loading) {
    return (
      <main className="px-4 pt-6 pb-28">
        <p className="text-sm text-[color:var(--surface-muted)]">불러오는 중...</p>
      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main className="px-4 pt-6 pb-28">
        <AdminPageHeader title="이벤트" backHref="/admin/events" />
        <p className="text-sm text-[color:var(--surface-muted)]">이벤트를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const inputCls =
    "h-10 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";
  const labelCls = "mb-1.5 block text-xs font-semibold text-[color:var(--surface-muted)]";

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

      <h2 className="mb-2 text-[13px] font-bold text-[color:var(--surface-text)]">참가자 명단</h2>
      <EventParticipantRoster eventId={event.id} eventStatus={event.status} />
    </main>
  );
}
