"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { PLAYER_BACKGROUND_OPTIONS, type PlayerBackground } from "@/lib/constants/member-timeline";
import { useAdminAccess } from "@/lib/hooks/useAdminAccess";
import type { MemberRole, MemberWithStats } from "@/lib/supabase/database.types";

interface EditMemberModalProps {
  member: MemberWithStats;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

const ROLES: MemberRole[] = [
  "회장",
  "부회장",
  "총무",
  "경기이사",
  "홍보이사",
  "운영이사",
  "섭외이사",
  "고문",
];
/** select에서 "직책 없음"을 표현하는 센티널 값. 제출 시 null로 변환한다(신규 등록 폼과 동일한 패턴). */
const NO_ROLE = "__none__";

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
  // 직책(role) 변경은 owner 전용 — 서버(PUT /api/members/[id])가 최종적으로
  // 강제하지만, manager에게는 애초에 select를 비활성화해서 "바꿀 수 없는
  // 항목"임을 명확히 보여준다. role이 아직 로딩 중(null)이면 일단 비활성으로
  // 둔다 — "확실히 owner라고 확인되기 전까지는 막아둔다"는 보수적 기본값.
  const adminAccess = useAdminAccess();
  // 로딩 중(null)이면 false — 확인되기 전까지 보수적으로 막음
  const isAdmin = adminAccess?.isAdmin ?? false;
  const isOwner = adminAccess?.isOwner ?? false;
  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
  const [phoneDigits, setPhoneDigits] = useState(member.phone ?? "");
  const [age, setAge] = useState(member.age?.toString() ?? "");
  const [addressFull, setAddressFull] = useState(member.address_full ?? "");
  const [district, setDistrict] = useState(member.district ?? "");
  const [mapoScore, setMapoScore] = useState<number | null>(member.mapo_score);
  const [role, setRole] = useState<string>(member.role ?? NO_ROLE);
  const [isDormant, setIsDormant] = useState(member.is_dormant);
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
        // role(직책)은 owner만 보낸다 — manager는 select가 disabled라 값이
        // 바뀔 수 없지만, 만약을 위해 payload 자체에서도 필드를 빼서 서버의
        // "role 필드가 있으면 owner 검증" 분기를 건드리지 않는다. 이러면
        // manager가 다른 필드만 고치는 정상적인 수정은 막히지 않는다.
        ...(isOwner ? { role: role === NO_ROLE ? null : role } : {}),
        isDormant,
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
    const confirmed = window.confirm(
      "이 회원을 탈퇴 처리할까요?\n과거 경기 기록은 유지되며, 신규 경기 입력에서는 제외됩니다."
    );
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeleting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "회원 삭제에 실패했습니다.");
      return;
    }

    toast.success("회원이 탈퇴 처리되었습니다.");
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
            <label className="mb-1 block text-xs font-semibold text-line-600">직책</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={!isOwner}
              className={`h-11 w-full rounded-lg border px-3 text-sm ${
                isOwner
                  ? "border-line-200 bg-line-25 text-line-900"
                  : "border-line-200 bg-line-200/40 text-line-500"
              }`}
            >
              <option value={NO_ROLE}>직책 없음</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {!isOwner && (
              <p className="mt-1.5 text-xs text-line-400">직책 변경은 owner만 가능합니다.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">회원 상태</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDormant(false)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  !isDormant
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                활동
              </button>
              <button
                type="button"
                onClick={() => setIsDormant(true)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  isDormant
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                휴면
              </button>
            </div>
            <p className="mt-1.5 text-xs text-line-400">
              휴면회원은 목록과 랭킹에는 남지만, 출석 체크와 신규 경기 등록 대상에서는 제외됩니다.
            </p>
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

        {isOwner && (
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
              {deleting ? "처리 중..." : "탈퇴 처리"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
