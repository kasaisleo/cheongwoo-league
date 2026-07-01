"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import type { MemberGrade } from "@/lib/supabase/database.types";

type FormType = "member" | "guest";

const GRADES: { value: MemberGrade; label: string }[] = [
  { value: "A", label: "A — 상급" },
  { value: "B", label: "B — 중상급" },
  { value: "C", label: "C — 중급" },
  { value: "D", label: "D — 초급" },
];

const MAPO_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface Props {
  type: FormType;
}

export function NewMemberClient({ type }: Props) {
  const router = useRouter();
  const isGuest = type === "guest";

  const [name, setName]           = useState("");
  const [nickname, setNickname]   = useState("");
  const [grade, setGrade]         = useState<MemberGrade>("C");
  const [phone, setPhone]         = useState("");
  const [mapoScore, setMapoScore] = useState<number | null>(null);
  const [addressFull, setAddressFull] = useState("");
  const [district, setDistrict]   = useState("");
  const [age, setAge]             = useState("");
  const [memo, setMemo]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const memberType = isGuest ? "게스트" : "정회원";
  const eyebrow    = isGuest ? "Admin · New Guest" : "Admin · New Member";
  const headline   = isGuest ? "게스트 등록" : "회원 등록";
  const desc       = isGuest
    ? "게스트 경기에 참여할 임시 회원 정보를 등록합니다."
    : "청우회 리그에 참여할 회원 정보를 등록합니다.";

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.replace(/\s+/g, "").trim()) e.name = "이름을 입력해주세요.";
    if (!grade) e.grade = "등급을 선택해주세요.";
    if (phone.trim()) {
      const d = phone.replace(/\D/g, "");
      if (!/^010\d{8}$/.test(d)) e.phone = "010으로 시작하는 11자리를 입력해주세요.";
    }
    if (!isGuest && mapoScore === null) e.mapoScore = "마포점수를 선택해주세요.";
    if (age.trim() && (isNaN(Number(age)) || Number(age) < 0 || Number(age) > 120)) {
      e.age = "올바른 나이를 입력해주세요.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        nickname: nickname.trim() || undefined,
        grade,
        memberType,
        phone: phone.trim() || undefined,
        mapoScore: isGuest ? undefined : mapoScore,
        addressFull: isGuest ? undefined : (addressFull.trim() || undefined),
        district: isGuest ? undefined : (district.trim() || undefined),
        age: age.trim() ? Number(age) : undefined,
        memo: memo.trim() || undefined,
      }),
    });

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "등록에 실패했습니다.");
      return;
    }

    toast.success(`${memberType} "${name.replace(/\s+/g, "").trim()}"이(가) 등록되었습니다.`);
    router.push(`/members/${body.memberId}`);
  }

  return (
    <main className="px-4 pt-6 pb-28">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">{eyebrow}</p>
          <h1 className="headline-kr text-4xl text-line-900">{headline}</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-6 text-sm text-line-500">{desc}</p>

      <div className="space-y-4">
        {/* 기본 정보 */}
        <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="border-b border-line-200/30 px-4 py-2.5">
            <p className="text-[11px] font-semibold text-line-500">기본 정보</p>
          </div>
          <div className="space-y-3 px-4 py-4">
            {/* 이름 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">
                이름 <span className="text-fault-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="실명 입력"
                className={`h-10 w-full rounded-sm border px-3 text-sm text-line-900 placeholder:text-line-400 ${
                  errors.name ? "border-fault-400/60 bg-fault-400/5" : "border-line-200/40 bg-line-100"
                }`}
              />
              {errors.name && <p className="mt-1 text-[11px] text-fault-400">{errors.name}</p>}
            </div>

            {/* 닉네임 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">
                닉네임 <span className="text-line-400 text-[10px] font-normal">(비우면 이름과 동일)</span>
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임 입력"
                className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
              />
            </div>

            {/* 등급 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">
                등급 <span className="text-fault-400">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as MemberGrade)}
                className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900"
              >
                {GRADES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {errors.grade && <p className="mt-1 text-[11px] text-fault-400">{errors.grade}</p>}
            </div>

            {/* 전화번호 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">
                전화번호
                {isGuest && <span className="ml-1 text-line-400 text-[10px] font-normal">(선택)</span>}
                {!isGuest && <span className="text-fault-400"> *</span>}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                inputMode="numeric"
                className={`h-10 w-full rounded-sm border px-3 text-sm text-line-900 placeholder:text-line-400 ${
                  errors.phone ? "border-fault-400/60 bg-fault-400/5" : "border-line-200/40 bg-line-100"
                }`}
              />
              {errors.phone && <p className="mt-1 text-[11px] text-fault-400">{errors.phone}</p>}
            </div>
          </div>
        </section>

        {/* 마포점수 — 회원만 */}
        {!isGuest && (
          <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="border-b border-line-200/30 px-4 py-2.5">
              <p className="text-[11px] font-semibold text-line-500">마포구 대회 점수 <span className="text-fault-400">*</span></p>
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {MAPO_SCORES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => setMapoScore(s)}
                    className={`h-9 w-10 rounded-sm border text-sm font-semibold transition-colors ${
                      mapoScore === s
                        ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                        : "border-line-200/40 bg-line-50 text-line-600"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              {errors.mapoScore && <p className="mt-2 text-[11px] text-fault-400">{errors.mapoScore}</p>}
            </div>
          </section>
        )}

        {/* 추가 정보 — 회원만 */}
        {!isGuest && (
          <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="border-b border-line-200/30 px-4 py-2.5">
              <p className="text-[11px] font-semibold text-line-500">추가 정보 <span className="text-line-400 text-[10px] font-normal">(선택)</span></p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-line-600">나이</label>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="예: 35"
                  inputMode="numeric"
                  className={`h-10 w-full rounded-sm border px-3 text-sm text-line-900 placeholder:text-line-400 ${
                    errors.age ? "border-fault-400/60 bg-fault-400/5" : "border-line-200/40 bg-line-100"
                  }`}
                />
                {errors.age && <p className="mt-1 text-[11px] text-fault-400">{errors.age}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-line-600">지역구</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="예: 마포구"
                  className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-line-600">주소</label>
                <input
                  value={addressFull}
                  onChange={(e) => setAddressFull(e.target.value)}
                  placeholder="상세 주소"
                  className="h-10 w-full rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
                />
              </div>
            </div>
          </section>
        )}

        {/* 메모 */}
        <section className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="border-b border-line-200/30 px-4 py-2.5">
            <p className="text-[11px] font-semibold text-line-500">메모 <span className="text-line-400 text-[10px] font-normal">(선택)</span></p>
          </div>
          <div className="px-4 py-4">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={isGuest ? "게스트 관련 메모" : "회원 관련 메모"}
              rows={3}
              className="w-full rounded-sm border border-line-200/40 bg-line-100 px-3 py-2 text-sm text-line-900 placeholder:text-line-400 resize-none"
            />
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
            {submitting ? "등록 중..." : `${isGuest ? "게스트" : "회원"} 등록`}
          </button>
        </div>
      </div>
    </main>
  );
}
