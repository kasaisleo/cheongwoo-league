"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { Event, EventStatus } from "@/lib/supabase/database.types";

interface EventsPageClientProps {
  /** 표시용 — API 요청에는 쓰지 않는다(클럽 스코프는 서버가 access.clubId로만 결정). */
  currentClubId: string;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "초안",
  active: "진행중",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_COLOR: Record<EventStatus, string> = {
  draft: "#7C92AC",
  active: "#2EA86B",
  completed: "#5C7596",
  cancelled: "#FF5C72",
};

export function EventsPageClient({ currentClubId: _currentClubId }: EventsPageClientProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/events");
      const body = await res.json().catch(() => null);
      setLoading(false);
      if (res.ok) setEvents(body.events ?? []);
    }
    load();
  }, []);

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="경기 관리"
        description="Match System 2.0 Event 목록 및 참가자 명단 관리."
        backHref="/admin"
        action={
          <Link
            href="/admin/events/new"
            className="whitespace-nowrap rounded-[var(--admin-button-radius,6px)] border px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
          >
            + 새 이벤트
          </Link>
        }
      />

      {loading ? (
        <p className="text-sm text-[color:var(--surface-muted)]">불러오는 중...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-[color:var(--surface-muted)]">아직 생성된 이벤트가 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)]">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}`}
              className="flex items-center gap-3 border-l-4 border-b border-b-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3 last:border-b-0 hover:opacity-80"
              style={{ borderLeftColor: STATUS_COLOR[event.status] }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">
                  {event.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[color:var(--surface-muted)]">{event.event_date}</p>
              </div>
              <span className="text-[11px] font-semibold" style={{ color: STATUS_COLOR[event.status] }}>
                {STATUS_LABEL[event.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
