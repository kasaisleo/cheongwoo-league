"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { PLAYER_BACKGROUND_OPTIONS, type PlayerBackground } from "@/lib/constants/member-timeline";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface EditMemberModalProps {
  member: MemberWithStats;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
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

export function EditMemberModal({ member, onClose, onSaved, onDeleted }: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
  const [phoneDigits, setPhoneDigits] = useState(member.phone ?? "");
  const [age, setAge] = useState(member.age?.toString() ?? "");
  const [addressFull, setAddressFull] = useState(member.address_full ?? "");
  const [district, setDistrict] = useState(member.district ?? "");
  const [mapoScore, setMapoScore] = useState<number | null>(member.mapo_score);
  const [memo, setMemo] = useState(member.memo ?? "");
  const initialPlayerBackground = (member.player_background as PlayerBackground) || "none";
  const [isPlayerOrigin, setIsPlayerOrigin] = useState(initialPlayerBackground !== "none");
  const [playerBackgroundDetail, setPlayerBackgroundDetail] = useState<PlayerBackground>(
    initialPlayerBackground !== "none" ? initialPlayerBackground : "elementary"
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1단계에서 "비선출"을 선택하면 항상 'none'으로, "선출"을 선택하면 2단계에서 고른 세부값으로 저장한다.
  const playerBackgroundOptions = PLAYER_BACKGROUND_OPTIONS.filter((o) => o.value !== "none");

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
        mapoScore,
        memo: memo.trim() || null,
        playerBackground: isPlayerOrigin ? playerBackgroundDetail : "none",
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

  async function handleDelete() {
    const confirmedFirst = window.confirm("정말 이 회원을 삭제하시겠습니까?");
    if (!confirmedFirst) return;

    const confirmedSecond = window.confirm(
      "회원 목록에서는 숨겨지지만 기존 경기/출석/LP 이력은 보존됩니다."
    );
    if (!confirmedSecond) return;

    setDeleting(true);
    const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeleting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "회원 삭제에 실패했습니다.");
      return;
    }

    toast.success("회원이 삭제되었습니다.");
    onDeleted();
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
            <label className="mb-1 block text-xs font-semibold text-line-600">선수출신</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPlayerOrigin(false)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  !isPlayerOrigin
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                비선출
              </button>
              <button
                type="button"
                onClick={() => setIsPlayerOrigin(true)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  isPlayerOrigin
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                선출
              </button>
            </div>

            {isPlayerOrigin && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {playerBackgroundOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPlayerBackgroundDetail(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      playerBackgroundDetail === option.value
                        ? "border-court-400 bg-court-400 text-line-25"
                        : "border-line-200 text-line-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
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

        <div className="mt-6 border-t border-line-200 pt-4">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-line-400">
            위험 구역
          </p>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="h-11 w-full rounded-lg border border-fault-400 text-xs font-semibold text-fault-400 disabled:opacity-40"
          >
            {deleting ? "삭제 중..." : "회원 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
