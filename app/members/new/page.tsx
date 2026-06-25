"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MemberRole, MemberType } from "@/lib/supabase/database.types";

const ROLES: MemberRole[] = [
  "회장",
  "부회장",
  "총무",
  "경기이사",
  "홍보이사",
  "운영이사",
  "섭외이사",
  "정회원",
  "고문",
];
const MEMBER_TYPES: MemberType[] = ["정회원", "준회원", "게스트"];
const MAPO_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** grade 컬럼은 DB에서 아직 제거하지 않았지만, 화면에서는 더 이상 입력받지 않는다.
 * API가 필수로 검증하므로 고정값을 그대로 전송한다. */
const DEFAULT_GRADE = "C";

/** 숫자만 추출, 최대 11자리로 자름 */
function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** 010-0000-0000 형태로 화면에 보여줄 포맷 */
function formatPhoneForDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function NewMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [role, setRole] = useState<MemberRole>("정회원");
  const [memberType, setMemberType] = useState<MemberType | null>(null);
  const [mapoScore, setMapoScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhoneChange(value: string) {
    setPhoneDigits(sanitizePhoneDigits(value));
  }

  /** 제출 전 클라이언트측 필수값 검증. 통과하지 못하면 alert로 안내하고 false 반환. */
  function validateBeforeSubmit(): boolean {
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return false;
    }
    if (!phoneDigits.trim()) {
      alert("휴대폰 번호를 입력해주세요.");
      return false;
    }
    if (!/^010\d{8}$/.test(phoneDigits)) {
      alert("휴대폰 번호는 010으로 시작하는 11자리여야 합니다.");
      return false;
    }
    if (mapoScore === null) {
      alert("마포점수를 선택해주세요.");
      return false;
    }
    if (!memberType) {
      alert("회원구분을 선택해주세요.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validateBeforeSubmit()) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        nickname: nickname.trim() || null,
        phone: phoneDigits,
        grade: DEFAULT_GRADE,
        role,
        mapoScore,
        memberType,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        setError("이미 등록된 휴대폰 번호입니다.");
      } else {
        setError(body?.error ?? "회원 등록에 실패했습니다. 다시 시도해주세요.");
      }
      return;
    }

    alert("회원 등록이 완료되었습니다.");
    router.push("/members");
    router.refresh();
  }

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          New Member
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">회원 등록</h1>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김철수"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">닉네임 (선택)</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 철수 (비워두면 이름으로 등록)"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">휴대폰 번호</label>
            <input
              type="tel"
              inputMode="numeric"
              value={formatPhoneForDisplay(phoneDigits)}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="010-0000-0000"
              maxLength={13}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">회원구분</label>
            <div className="flex gap-2">
              {MEMBER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMemberType(t)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    memberType === t
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">직책</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">
              마포구 대회 점수 (1~10)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MAPO_SCORES.map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setMapoScore(mapoScore === score ? null : score)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                    mapoScore === score
                      ? "border-court-400 bg-court-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-line-400">
              클럽 레이팅과는 별개의 점수이며, 레이팅 계산에 영향을 주지 않습니다.
            </p>
          </div>
        </Card>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <Button type="submit" size="lg" className="mt-4 w-full" disabled={submitting}>
          {submitting ? "등록 중..." : "회원 등록"}
        </Button>
      </form>
    </main>
  );
}
