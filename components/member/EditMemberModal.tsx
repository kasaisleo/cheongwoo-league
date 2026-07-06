"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { useAdminAccess } from "@/lib/hooks/useAdminAccess";
import type { MemberWithStats } from "@/lib/supabase/database.types";
import type { PlayerBackground } from "@/lib/constants/member-timeline";
import {
  MemberForm,
  getDefaultFormValues,
  NO_ROLE,
  type MemberFormValues,
} from "@/components/member/MemberForm";

interface EditMemberModalProps {
  member: MemberWithStats;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  currentClubId: string;
}

export function EditMemberModal({ member, onClose, onSaved, onDeleted, currentClubId }: EditMemberModalProps) {
  const adminAccess = useAdminAccess(currentClubId);
  const isAdmin = adminAccess?.isAdmin ?? false;
  const isOwner = adminAccess?.isOwner ?? false;

  const initialPlayerBackground = (member.player_background as PlayerBackground) || "none";

  const [values, setValues] = useState<MemberFormValues>(
    getDefaultFormValues({
      name: member.name,
      nickname: member.nickname,
      phoneDigits: member.phone ?? "",
      age: member.age?.toString() ?? "",
      district: member.district ?? "",
      addressFull: member.address_full ?? "",
      mapoScore: member.mapo_score,
      role: member.role ?? NO_ROLE,
      isDormant: member.is_dormant,
      isPlayerOrigin: initialPlayerBackground !== "none",
      playerBackgroundDetail:
        initialPlayerBackground !== "none" ? initialPlayerBackground : "elementary",
      memo: member.memo ?? "",
    })
  );

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "이름을 입력해주세요.";
    if (!/^010\d{8}$/.test(values.phoneDigits)) {
      e.phoneDigits = "010으로 시작하는 11자리를 입력해주세요.";
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
    setError(null);

    const res = await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        nickname: values.nickname.trim() || null,
        phone: values.phoneDigits,
        age: values.age.trim() ? Number(values.age) : null,
        addressFull: values.addressFull.trim() || null,
        district: values.district.trim() || null,
        mapoScore: values.mapoScore,
        memo: values.memo.trim() || null,
        playerBackground: values.isPlayerOrigin ? values.playerBackgroundDetail : "none",
        isDormant: values.isDormant,
        ...(isOwner ? { role: values.role === NO_ROLE ? null : values.role } : {}),
      }),
    });

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
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
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[14px] border border-line-200/40 bg-line-50 p-4 shadow-card">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-clay-400">회원 정보 수정</p>
          <button type="button" onClick={onClose}
            className="text-xs font-semibold text-line-500 hover:text-line-700">
            닫기
          </button>
        </div>

        {/* 공용 폼 */}
        <MemberForm
          mode="edit"
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          isOwner={isOwner}
          showStatus={true}
          errors={errors}
        />

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        {/* 저장 버튼 */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-4 h-12 w-full rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
        >
          {submitting ? "저장 중..." : "수정 내용 저장"}
        </button>

        {/* 탈퇴 처리 — owner/master만 */}
        {isOwner && (
          <div className="mt-6 border-t border-line-200/40 pt-4">
            <p className="mb-2 text-center text-[11px] font-semibold text-line-400">
              위험 구역
            </p>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="h-11 w-full rounded-sm border border-fault-400/60 text-xs font-semibold text-fault-400 disabled:opacity-40"
            >
              {deleting ? "처리 중..." : "탈퇴 처리"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
