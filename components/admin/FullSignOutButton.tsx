"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * FullSignOutButton — 카카오 세션 + cw_admin_session 동시 종료.
 *
 * 처리 순서:
 *   1. supabase.auth.signOut()  — 카카오 세션 종료
 *   2. POST /api/auth/logout    — cw_admin_session 쿠키 제거
 *   3. 클럽 context 있으면 /c/[slug], 없으면 /로 이동
 */
interface FullSignOutButtonProps {
  className?: string;
  label?: string;
}

export function FullSignOutButton({
  className = "",
  label = "전체 로그아웃",
}: FullSignOutButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  async function handleFullSignOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });

      const slugMatch = pathname?.match(/^\/c\/([^/]+)/);
      const dest = slugMatch ? `/c/${slugMatch[1]}` : "/";
      router.push(dest);
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={loading}
        onClick={handleFullSignOut}
        className={`text-xs font-semibold text-line-500 transition-colors hover:text-line-700 disabled:opacity-40 ${className}`}
      >
        {loading ? "로그아웃 중..." : label}
      </button>
      <p className="text-[10px] leading-none text-line-400">
        카카오 로그인과 관리자 세션을 모두 종료합니다.
      </p>
    </div>
  );
}
