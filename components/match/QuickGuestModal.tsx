"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Guest } from "@/lib/supabase/database.types";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

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
  const [error, setError] = useState<string | null>(null);

  const isReady = name.trim().length > 0 && visitDate.length > 0 && !submitting;

  async function handleSubmit() {
    if (!isReady) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("guests")
      .insert({
        name: name.trim(),
        club_id: CHEONGWOO_CLUB_ID,
        age: age ? Number(age) : null,
        years_playing: yearsPlaying ? Number(yearsPlaying) : null,
        phone: phone.trim() || null,
        visit_date: visitDate,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError("게스트 등록에 실패했습니다.");
      return;
    }

    onCreated(data as Guest);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-line-200 bg-line-100 p-4 shadow-card">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-clay-400">게스트 등록</p>

        <div className="space-y-3 overflow-hidden">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            autoFocus
            className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="나이"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={yearsPlaying}
              onChange={(e) => setYearsPlaying(e.target.value)}
              placeholder="구력(년)"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="휴대폰 번호"
            className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
          />

          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
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
