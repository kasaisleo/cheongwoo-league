"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "@/lib/hooks/useAdminAccess";
import { toast } from "@/components/ui/Toast";

const ROLE_LABEL: Record<string, string> = {
  master: "Master",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  scorer: "Scorer",
};

const ROLE_CHIP: Record<string, string> = {
  master: "border-gold/40 bg-gold/10 text-gold",
  admin: "border-clay-400/40 bg-clay-400/10 text-clay-400",
  manager: "border-line-300/40 bg-line-200 text-line-700",
  member: "border-line-200/40 bg-line-100 text-line-500",
  scorer: "border-line-200/40 bg-line-100 text-line-500",
};

interface MemberStatusSectionProps {
  memberId: string;
  memberName: string;
  isActive: boolean;
  deletedAt: string | null;
  permissionRole: string;
  authUserId: string | null;  // auth_user_id 기준 — /api/admin/unlink-member와 동일
  currentClubId: string;
}

/**
 * MemberStatusSection — 회원 상세 관리자 전용 상태 섹션.
 *
 * 표시:
 *   - 회원 상태 (활동중 / 탈퇴 처리됨 + 처리일)
 *   - 권한 (permission_role)
 *   - 카카오 연결 상태
 *   - 카카오 연결 해제 버튼 (isOwner만)
 *
 * 권한: useAdminAccess() — 로딩 중이면 섹션 자체를 숨김
 */
export function MemberStatusSection({
  memberId,
  memberName,
  isActive,
  deletedAt,
  permissionRole,
  authUserId,
  currentClubId,
}: MemberStatusSectionProps) {
  const router = useRouter();
  const adminAccess = useAdminAccess(currentClubId);
  // auth_user_id 기준 — /api/admin/unlink-member가 null 처리하는 컬럼과 동일
  const [isKakaoLinked, setIsKakaoLinked] = useState(Boolean(authUserId));
  const [unlinking, setUnlinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateConfirming, setReactivateConfirming] = useState(false);

  // 로딩 중이거나 관리자가 아니면 미노출
  if (!adminAccess?.isAdmin) return null;

  const isOwner = adminAccess.isOwner;
  // is_active/deleted_at 불일치 row가 실제로 있어 둘 중 하나라도 비활성 신호면 비활성으로 본다.
  const isEffectivelyActive = isActive && !deletedAt;

  async function handleReactivate() {
    setReactivating(true);
    setReactivateConfirming(false);
    const res = await fetch("/api/admin/reactivate-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const body = await res.json().catch(() => null);
    setReactivating(false);

    if (!res.ok) {
      toast.error(body?.error ?? "복구에 실패했습니다.");
      return;
    }
    toast.success(body?.message ?? `${memberName} 님을 복구했습니다.`);
    router.refresh();
  }

  async function handleUnlink() {
    setUnlinking(true);
    setConfirming(false);
    const res = await fetch("/api/admin/unlink-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const body = await res.json().catch(() => null);
    setUnlinking(false);

    if (!res.ok) {
      toast.error(body?.error ?? "연결 해제에 실패했습니다.");
      return;
    }
    toast.success(`${memberName}의 카카오 연결이 해제되었습니다.`);
    setIsKakaoLinked(false);
    router.refresh();
  }

  const deletedDate = deletedAt
    ? new Date(deletedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="border-b border-line-200/30 px-4 py-2.5">
        <p className="text-[10px] font-semibold text-line-500">관리자 정보</p>
      </div>

      <div className="divide-y divide-line-200/30">
        {/* 회원 상태 */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-line-900">회원 상태</p>
          {isEffectivelyActive ? (
            <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[10px] font-semibold text-line-600">
              활동중
            </span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-col items-end gap-0.5">
                <span className="rounded-sm border border-fault-400/30 bg-fault-400/5 px-2 py-0.5 text-[10px] font-semibold text-fault-400">
                  탈퇴 처리됨
                </span>
                {deletedDate && (
                  <p className="text-[9px] text-line-400">{deletedDate}</p>
                )}
              </div>
              {reactivateConfirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-line-500">복구할까요?</span>
                  <button
                    type="button"
                    disabled={reactivating}
                    onClick={handleReactivate}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-clay-400 disabled:opacity-40"
                  >
                    {reactivating ? "..." : "확인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReactivateConfirming(false)}
                    className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-500"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReactivateConfirming(true)}
                  className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-400 hover:border-clay-400/60 hover:text-clay-400"
                >
                  활동 상태로 복구
                </button>
              )}
            </div>
          )}
        </div>

        {/* 권한 */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-line-900">권한</p>
          <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${ROLE_CHIP[permissionRole] ?? ROLE_CHIP.member}`}>
            {ROLE_LABEL[permissionRole] ?? permissionRole}
          </span>
        </div>

        {/* 카카오 연결 */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-line-900">카카오 연결</p>
          <div className="flex items-center gap-2">
            <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
              isKakaoLinked
                ? "border-line-200/40 bg-line-100 text-line-600"
                : "border-line-200/30 text-line-400"
            }`}>
              {isKakaoLinked ? "연결됨" : "연결 안 됨"}
            </span>

            {/* 연결 해제 — owner/master만 */}
            {isOwner && isKakaoLinked && (
              confirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-line-500">해제할까요?</span>
                  <button
                    type="button"
                    disabled={unlinking}
                    onClick={handleUnlink}
                    className="rounded-sm border border-fault-400/60 bg-fault-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-fault-400 disabled:opacity-40"
                  >
                    {unlinking ? "..." : "확인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-500"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-400 hover:border-fault-400/60 hover:text-fault-400"
                >
                  연결 해제
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
