"use client";

/**
 * GuestRegistrationForm — guests 테이블 기반 게스트 등록 폼.
 *
 * guests 테이블 구조:
 *   name, visit_date, age, years_playing, phone,
 *   referred_by, manner_score, reinvite, notes
 *
 * skill_grade: DB에 있지만 UI 노출 제외 (요청사항)
 * members 테이블과 무관 — guests 테이블에 직접 insert
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import type { Member } from "@/lib/supabase/database.types";

import { DEFAULT_CLUB_ID } from "@/lib/current-club";

const CHEONGWOO_CLUB_ID = DEFAULT_CLUB_ID;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function GuestRegistrationForm() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);

  // 필수
  const [name, setName]           = useState("");
  const [visitDate, setVisitDate] = useState(todayString());

  // 선택
  const [phone, setPhone]               = useState("");
  const [age, setAge]                   = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [referredBy, setReferredBy]     = useState("");
  const [notes, setNotes]               = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  // 소개 회원 목록 로드
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("members")
      .select("id, name, nickname")
      .eq("is_active", true)
      .eq("is_dormant", false)
      .eq("club_id", CHEONGWOO_CLUB_ID)
      .order("name")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!normalizeName(name)) e.name = "이름을 입력해주세요.";
    if (!visitDate)           e.visitDate = "방문 날짜를 선택해주세요.";
    if (phone.trim()) {
      const d = phone.replace(/\D/g, "");
      if (!/^010\d{8}$/.test(d)) e.phone = "010으로 시작하는 11자리를 입력해주세요.";
    }
    if (age.trim()) {
      const n = Number(age);
      if (isNaN(n) || n < 0 || n > 120) e.age = "올바른 나이를 입력해주세요.";
    }
    if (yearsPlaying.trim()) {
      const n = Number(yearsPlaying);
      if (isNaN(n) || n < 0) e.yearsPlaying = "올바른 구력을 입력해주세요.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: guest, error: insertError } = await supabase
      .from("guests")
      .insert({
        name: normalizeName(name),
        club_id: CHEONGWOO_CLUB_ID,
        visit_date: visitDate,
        phone: phone.trim() ? phone.replace(/\D/g, "") : null,
        age: age.trim() ? Number(age) : null,
        years_playing: yearsPlaying.trim() ? Number(yearsPlaying) : null,
        referred_by: referredBy || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError || !guest) {
      toast.error("게스트 등록에 실패했습니다.");
      return;
    }

    toast.success(`게스트 "${normalizeName(name)}"이(가) 등록되었습니다.`);
    router.push("/guests");
    router.refresh();
  }

  const inputCls = (err?: string) =>
    `h-10 w-full rounded-sm border px-3 text-sm text-line-900 placeholder:text-line-400 ${
      err ? "border-fault-400/60 bg-fault-400/5" : "border-line-200/40 bg-line-50"
    }`;

  const labelCls = "mb-1 block text-xs font-semibold text-line-600";

  return (
    <main className="px-4 pt-6 pb-28">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · New Guest</p>
          <h1 className="headline-kr text-4xl text-line-900">게스트 등록</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-6 text-sm text-line-500">
        게스트 경기에 참여할 방문자 정보를 등록합니다.
      </p>

      <div className="space-y-4">

        {/* 필수 정보 */}
        <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="border-b border-line-200/30 px-4 py-2.5">
            <p className="text-[11px] font-semibold text-line-500">
              필수 정보
            </p>
          </div>
          <div className="space-y-3 px-4 py-4">

            {/* 이름 */}
            <div>
              <label className={labelCls}>
                이름 <span className="text-fault-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="게스트 이름"
                className={inputCls(errors.name)}
              />
              {errors.name && <p className="mt-1 text-[11px] text-fault-400">{errors.name}</p>}
            </div>

            {/* 방문 날짜 */}
            <div>
              <label className={labelCls}>
                방문 날짜 <span className="text-fault-400">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className={inputCls(errors.visitDate)}
              />
              {errors.visitDate && <p className="mt-1 text-[11px] text-fault-400">{errors.visitDate}</p>}
            </div>

          </div>
        </section>

        {/* 추가 정보 */}
        <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="border-b border-line-200/30 px-4 py-2.5">
            <p className="text-[11px] font-semibold text-line-500">
              추가 정보 <span className="text-line-400 text-[10px] font-normal">(선택)</span>
            </p>
          </div>
          <div className="space-y-3 px-4 py-4">

            {/* 전화번호 */}
            <div>
              <label className={labelCls}>전화번호</label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className={inputCls(errors.phone)}
              />
              {errors.phone && <p className="mt-1 text-[11px] text-fault-400">{errors.phone}</p>}
            </div>

            {/* 나이 + 구력 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>나이</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="예: 35"
                  className={inputCls(errors.age)}
                />
                {errors.age && <p className="mt-1 text-[11px] text-fault-400">{errors.age}</p>}
              </div>
              <div>
                <label className={labelCls}>구력 (년)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={yearsPlaying}
                  onChange={(e) => setYearsPlaying(e.target.value)}
                  placeholder="예: 3.5"
                  className={inputCls(errors.yearsPlaying)}
                />
                {errors.yearsPlaying && <p className="mt-1 text-[11px] text-fault-400">{errors.yearsPlaying}</p>}
              </div>
            </div>

            {/* 소개 회원 */}
            <div>
              <label className={labelCls}>소개 회원</label>
              <select
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                className="h-10 w-full rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900"
              >
                <option value="">소개 회원 없음</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.nickname !== m.name ? ` (${m.nickname})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 메모 */}
            <div>
              <label className={labelCls}>메모</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="게스트 관련 메모"
                rows={3}
                className="w-full resize-none rounded-sm border border-line-200/40 bg-line-50 px-3 py-2 text-sm text-line-900 placeholder:text-line-400"
              />
            </div>

          </div>
        </section>

        {/* 저장 + 취소 */}
        <div className="flex gap-3 pt-2">
          <Link href="/admin"
            className="flex h-12 flex-1 items-center justify-center rounded-sm border border-line-200/40 text-sm font-semibold text-line-500">
            취소
          </Link>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex h-12 flex-[2] items-center justify-center rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
          >
            {submitting ? "등록 중..." : "게스트 등록"}
          </button>
        </div>

      </div>
    </main>
  );
}
