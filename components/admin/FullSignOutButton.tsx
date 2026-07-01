"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * FullSignOutButton — 카카오 세션 + cw_admin_session 동시 종료.
 *
 * 처리 순서:
 *   1. supabase.auth.signOut()  — 카카오 세션 종료
 *   2. POST /api/auth/logout    — cw_admin_session 쿠키 제거 (기존 route 재사용)
 *   3. router.push("/")         — 홈으로 이동
 *
 * app/api/auth/logout/route.ts는 수정하지 않고 그대로 POST로 호출.
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
  const [loading, setLoading] = useState(false);

  async function handleFullSignOut() {
    setLoading(true);
    try {
      // 1. 카카오 세션 종료
      const supabase = createClient();
      await supabase.auth.signOut();

      // 2. cw_admin_session 쿠키 제거
      await fetch("/api/auth/logout", { method: "POST" });

      // 3. 홈으로 이동
      router.push("/");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleFullSignOut}
      className={`text-xs font-semibold text-line-500 transition-colors hover:text-line-700 disabled:opacity-40 ${className}`}
    >
      {loading ? "로그아웃 중..." : label}
    </button>
  );
}
