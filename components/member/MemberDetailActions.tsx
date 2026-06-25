"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { EditMemberModal } from "@/components/member/EditMemberModal";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface MemberDetailActionsProps {
  member: MemberWithStats;
}

/**
 * 회원 상세 화면의 운영진 전용 수정/삭제 액션.
 * manager 이상이 수행해야 하지만, 권한 시스템 도입 전이라 isAdminSession으로
 * 대체한다(서버에서 내려준 isAdmin 여부를 클라이언트에서 다시 확인).
 */
export function MemberDetailActions({ member }: MemberDetailActionsProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((body) => setIsAdmin(Boolean(body?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

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
    router.push("/members");
    router.refresh();
  }

  if (!isAdmin) return null;

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="h-10 flex-1 rounded-lg border border-line-200 text-xs font-semibold text-line-700"
        >
          회원 정보 수정
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="h-10 flex-1 rounded-lg border border-fault-400 text-xs font-semibold text-fault-400 disabled:opacity-40"
        >
          {deleting ? "삭제 중..." : "회원 삭제"}
        </button>
      </div>

      {showEditModal && (
        <EditMemberModal
          member={member}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
