"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

interface DeleteMatchButtonProps {
  matchId: string;
  playedAt: string;
}

/**
 * DeleteMatchButton — master/owner 전용 경기 삭제 버튼.
 * page.tsx에서 canDelete 판단 후 렌더링 여부 결정.
 * 이 컴포넌트 자체는 권한 체크 없이 UI/UX만 담당.
 */
export function DeleteMatchButton({ matchId, playedAt }: DeleteMatchButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeleting(false);
    setConfirming(false);

    if (!res.ok) {
      toast.error(body?.error ?? "삭제에 실패했습니다.");
      return;
    }
    toast.success("경기가 삭제되었습니다.");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>삭제할까요?</span>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="rounded-sm border border-fault-400/60 bg-fault-400/10 px-2 py-0.5 text-[10px] font-semibold text-fault-400 disabled:opacity-40"
        >
          {deleting ? "삭제 중..." : "확인"}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirming(false)}
          className="rounded-sm border border-[color:var(--admin-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--admin-muted)] transition-colors hover:border-[color:var(--admin-border-strong)]"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-sm border border-[color:var(--admin-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--admin-muted)] transition-colors hover:border-fault-400/60 hover:text-fault-400"
    >
      삭제
    </button>
  );
}
