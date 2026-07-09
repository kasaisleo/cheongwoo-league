"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import {
  MemberForm,
  getDefaultFormValues,
  NO_ROLE,
  type MemberFormValues,
} from "@/components/member/MemberForm";

type FormType = "member" | "guest";

interface Props {
  type: FormType;
  currentClubName?: string;
}

export function NewMemberClient({ type, currentClubName }: Props) {
  const router = useRouter();
  const isGuest = type === "guest";

  const [values, setValues] = useState<MemberFormValues>(
    getDefaultFormValues({ isDormant: false })
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const memberType = isGuest ? "게스트" : "정회원";
  const eyebrow    = isGuest ? "Admin · New Guest" : "Admin · New Member";
  const headline   = isGuest ? "게스트 등록" : "회원 등록";
  const desc       = isGuest
    ? "게스트 경기에 참여할 임시 회원 정보를 등록합니다."
    : `${currentClubName || "우리 클럽"}에 참여할 회원 정보를 등록합니다.`;

  function validate(): boolean {
    const e: Record<string, string> = {};
    const normalizedName = values.name.replace(/\s+/g, "").trim();
    if (!normalizedName) e.name = "이름을 입력해주세요.";
    if (!isGuest && values.phoneDigits.trim()) {
      if (!/^010\d{8}$/.test(values.phoneDigits)) {
        e.phoneDigits = "010으로 시작하는 11자리를 입력해주세요.";
      }
    }
    if (values.age.trim()) {
      const n = Number(values.age);
      if (isNaN(n) || n < 0 || n > 120) e.age = "올바른 나이를 입력해주세요.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const normalizedName = values.name.replace(/\s+/g, "").trim();

    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: normalizedName,
        nickname: values.nickname.trim() || undefined,
        grade: "C",           // API 내부에서 무시됨 — DB default 사용
        memberType,
        phone: values.phoneDigits || undefined,
        mapoScore: values.mapoScore ?? undefined,
        addressFull: values.addressFull.trim() || undefined,
        district: values.district.trim() || undefined,
        age: values.age.trim() ? Number(values.age) : undefined,
        memo: values.memo.trim() || undefined,
        playerBackground: values.isPlayerOrigin
          ? values.playerBackgroundDetail
          : "none",
      }),
    });

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "등록에 실패했습니다.");
      return;
    }

    toast.success(`${memberType} "${normalizedName}"이(가) 등록되었습니다.`);
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

      {/* 공용 폼 */}
      <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-5">
        <MemberForm
          mode="create"
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          errors={errors}
        />
      </div>

      {/* 저장 + 취소 */}
      <div className="mt-4 flex gap-3">
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
    </main>
  );
}
