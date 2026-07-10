"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditMemberModal } from "@/components/member/EditMemberModal";
import { useAdminAccess } from "@/lib/hooks/useAdminAccess";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface MemberDetailActionsProps {
  member: MemberWithStats;
  currentClubId: string;
  /** 삭제 후 이동할 경로. 미지정 시 "/members" (legacy fallback). */
  returnPath?: string;
}

/**
 * 회원 상세 화면의 운영진 전용 액션. manager 이상이 수행해야 하지만, 권한
 * 시스템 도입 전이라 isAdminSession으로 대체한다(서버에서 내려준 isAdmin
 * 여부를 클라이언트에서 다시 확인 — useIsAdmin 훅이 그 fetch를 담당한다).
 *
 * 삭제 버튼은 이 화면(상세 바로가기)이 아니라 수정 모달 하단에 둔다 — 우발적
 * 클릭으로 회원이 바로 삭제되는 사고를 줄이기 위함(EditMemberModal 참고).
 */
export function MemberDetailActions({ member, currentClubId, returnPath = "/members" }: MemberDetailActionsProps) {
  const router = useRouter();
  const adminAccess = useAdminAccess(currentClubId);
  const [showEditModal, setShowEditModal] = useState(false);

  // 로딩 중(null)이거나 비관리자면 렌더링 안 함
  if (!adminAccess?.isAdmin) return null;

  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="h-10 w-full rounded-lg border border-line-200 text-xs font-semibold text-line-700"
        >
          회원 정보 수정
        </button>
      </div>

      {showEditModal && (
        <EditMemberModal
          member={member}
          currentClubId={currentClubId}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            router.refresh();
          }}
          onDeleted={() => {
            setShowEditModal(false);
            router.push(returnPath);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
