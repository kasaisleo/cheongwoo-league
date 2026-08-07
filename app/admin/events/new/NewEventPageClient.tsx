"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { toast } from "@/components/ui/Toast";

export function NewEventPageClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("이벤트명을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), eventDate }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(body?.error ?? "이벤트 생성에 실패했습니다.");
      return;
    }
    toast.success("이벤트가 생성되었습니다.");
    router.push(`/admin/events/${body.eventId}`);
  }

  const inputCls =
    "h-10 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";
  const labelCls = "mb-1.5 block text-xs font-semibold text-[color:var(--surface-muted)]";

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader title="새 이벤트" description="이벤트명과 날짜만 입력하면 생성됩니다." backHref="/admin/events" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>이벤트명</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 8월 정기 매치"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>날짜</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[var(--admin-button-radius,6px)] border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
        >
          {submitting ? "생성 중..." : "이벤트 생성"}
        </button>
      </form>
    </main>
  );
}
