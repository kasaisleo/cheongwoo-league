"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { Guest } from "@/lib/supabase/database.types";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface QuickGuestModalProps {
  onClose: () => void;
  onCreated: (guest: Guest) => void;
}

export function QuickGuestModal({ onClose, onCreated }: QuickGuestModalProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [phone, setPhone] = useState("");
  const [visitDate, setVisitDate] = useState(todayString());
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = name.trim().length > 0 && visitDate.length > 0 && !submitting;

  async function handleSubmit() {
    if (!isReady) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          age: age ? Number(age) : null,
          years_playing: yearsPlaying ? Number(yearsPlaying) : null,
          phone: phone.trim() || null,
          visit_date: visitDate,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.guest) {
        setError(body?.error ?? "게스트 등록에 실패했습니다.");
        return;
      }

      onCreated(body.guest as Guest);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const inputCls =
    "h-11 w-full rounded-lg border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[var(--club-card-radius,14px)] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-4 shadow-card">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-clay-400">게스트 등록</p>

        <div className="space-y-3 overflow-hidden">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            autoFocus
            className={inputCls}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="나이"
              className={inputCls}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={yearsPlaying}
              onChange={(e) => setYearsPlaying(e.target.value)}
              placeholder="구력(년)"
              className={inputCls}
            />
          </div>

          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="휴대폰 번호"
            className={inputCls}
          />

          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className={`box-border block min-w-0 max-w-full ${inputCls}`}
          />
        </div>

        {error && <p className="mt-2 text-xs text-fault-400">{error}</p>}

        <div className="mt-4 flex gap-2">
          <Button size="md" className="flex-1" disabled={!isReady} onClick={handleSubmit}>
            {submitting ? "등록 중..." : "등록하고 선택"}
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
