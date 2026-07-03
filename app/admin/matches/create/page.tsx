"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import TennisBallLoader from "@/components/common/TennisBallLoader";
import type { SessionDay } from "@/lib/supabase/database.types";

const SESSION_DAY_OPTIONS: { value: SessionDay; label: string }[] = [
  { value: "saturday", label: "토요 정기매치" },
  { value: "sunday",   label: "일요 정기매치" },
  { value: "holiday",  label: "휴일매치" },
  { value: "custom",   label: "이벤트매치" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function MatchesCreatePage() {
  const router = useRouter();

  const [title, setTitle]     = useState("");
  const [date, setDate]       = useState(todayString());
  const [day, setDay]         = useState<SessionDay>("saturday");
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) { setError("매치명을 입력해주세요."); return; }
    if (!date)         { setError("날짜를 선택해주세요."); return; }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate: date, sessionDay: day, title: title.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "매치 생성에 실패했습니다.");
        return;
      }
      toast.success("매치가 생성되었습니다.");
      router.push(`/admin/attendance?session_id=${body.sessionId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="px-4 pt-6 pb-20">

      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Matches</p>
          <h1 className="headline-kr text-4xl text-line-900">매치 생성</h1>
          <p className="mt-1 max-w-[280px] break-keep text-xs leading-relaxed text-line-500">새 매치를 생성합니다.</p>
        </div>
        <Link href="/admin"
          className="flex-shrink-0 rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700 whitespace-nowrap">
          ← 관리자
        </Link>
      </header>

      {/* 입력 폼 */}
      <div className="space-y-4">

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-line-600">
            매치명 <span className="text-clay-400">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 7월 토요 정기매치"
            className="h-11 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-line-600">
            날짜 <span className="text-clay-400">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-line-600">매치 유형</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value as SessionDay)}
            className="h-11 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900">
            {SESSION_DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-clay-400">{error}</p>}

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          <Link href="/admin"
            className="flex h-11 flex-1 items-center justify-center rounded-sm border border-line-200/40 text-sm font-semibold text-line-500 hover:text-line-700">
            취소
          </Link>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="flex h-11 flex-1 items-center justify-center rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40">
            {creating ? "생성 중..." : "매치 생성"}
          </button>
        </div>
      </div>

      {/* 생성 중 오버레이 */}
      {creating && (
        <TennisBallLoader
          variant="overlay"
          mode="admin"
          label="매치 생성 중"
          description="새 매치를 등록하고 있어요."
        />
      )}

    </main>
  );
}
