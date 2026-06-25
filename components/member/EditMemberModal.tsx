"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import type { MemberGrade, MemberWithStats } from "@/lib/supabase/database.types";

const GRADES: MemberGrade[] = ["A", "B", "C", "D"];

interface EditMemberModalProps {
  member: MemberWithStats;
  onClose: () => void;
  onSaved: () => void;
}

/** 010-0000-0000 형태로 화면에 보여줄 포맷 (숫자만 입력받고 화면엔 자동 포맷) */
function formatPhoneForDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function EditMemberModal({ member, onClose, onSaved }: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
  const [phoneDigits, setPhoneDigits] = useState(member.phone ?? "");
  const [age, setAge] = useState(member.age?.toString() ?? "");
  const [addressFull, setAddressFull] = useState(member.address_full ?? "");
  const [district, setDistrict] = useState(member.district ?? "");
  const [grade, setGrade] = useState<MemberGrade>(member.grade);
  const [mapoScore, setMapoScore] = useState<number | null>(member.mapo_score);
  const [memo, setMemo] = useState(member.memo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (!/^010\d{8}$/.test(phoneDigits)) {
      toast.error("휴대폰 번호는 010으로 시작하는 11자리여야 합니다.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        nickname: nickname.trim() || null,
        phone: phoneDigits,
        age: age.trim() ? Number(age) : null,
        addressFull: addressFull.trim() || null,
        district: district.trim() || null,
        grade,
        mapoScore,
        memo: memo.trim() || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error ?? "회원 정보 수정에 실패했습니다.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("회원 정보가 수정되었습니다.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-line-200 bg-line-100 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wide text-clay-400">회원 정보 수정</p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-line-500">
            닫기
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">휴대폰 번호</label>
            <input
              type="tel"
              inputMode="numeric"
              value={formatPhoneForDisplay(phoneDigits)}
              onChange={(e) => setPhoneDigits(sanitizePhoneDigits(e.target.value))}
              maxLength={13}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">나이</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">동네(district)</label>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="예: 망원"
                className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">주소</label>
            <input
              value={addressFull}
              onChange={(e) => setAddressFull(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">실력 등급</label>
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    grade === g
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {g}급
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">마포구 대회 점수 (1~10)</label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">메모 (운영진 전용)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="box-border block w-full min-w-0 max-w-full resize-none rounded-lg border border-line-200 bg-line-25 px-3 py-2 text-sm text-line-900"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-4 h-12 w-full rounded-lg bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
        >
          {submitting ? "저장 중..." : "수정 내용 저장"}
        </button>
      </div>
    </div>
  );
}
