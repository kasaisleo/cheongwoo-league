"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { MemberGrade } from "@/lib/supabase/database.types";

const GRADES: MemberGrade[] = ["A", "B", "C", "D"];

interface ConvertGuestButtonProps {
  guestId: string;
  guestName: string;
  suggestedGrade: MemberGrade | null;
  guestPhone: string | null;
}

export function ConvertGuestButton({
  guestId,
  guestName,
  suggestedGrade,
  guestPhone,
}: ConvertGuestButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(guestName);
  const [phone, setPhone] = useState(guestPhone ?? "");
  const [grade, setGrade] = useState<MemberGrade>(suggestedGrade ?? "C");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!nickname.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/guests/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, nickname, grade, phone }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "전환에 실패했습니다.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-court-400 px-2.5 py-0.5 text-xs font-semibold text-court-400"
      >
        정회원으로 전환
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-line-200 bg-line-50 p-3">
      <p className="text-xs font-semibold text-line-700">정회원 전환 — {guestName}</p>

      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임"
        className="h-9 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
      />

      <input
        type="tel"
        inputMode="numeric"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="휴대폰 번호 (선택)"
        className="h-9 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
      />

      <div className="flex gap-1.5">
        {GRADES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrade(g)}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${
              grade === g
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200 text-line-600"
            }`}
          >
            {g}급
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-fault-400">{error}</p>}

      <div className="flex gap-1.5">
        <Button
          size="md"
          className="flex-1"
          disabled={submitting || !nickname.trim()}
          onClick={handleConvert}
        >
          {submitting ? "전환 중..." : "전환 확정"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)} disabled={submitting}>
          취소
        </Button>
      </div>
    </div>
  );
}
