"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AdminLogoutButtonProps {
  className?: string;
  label?: string;
}

/**
 * AdminLogoutButton — admin 전용 로그아웃.
 *
 * 처리 순서:
 *   1. supabase.auth.signOut() — Kakao 세션 종료 (cookie admin은 세션 없어 no-op)
 *   2. POST /api/auth/logout  — cw_admin_session + admin_club_slug 쿠키 제거
 *   3. /admin으로 이동 (public /c/[slug] 경로 이동 금지)
 *
 * public selected_club_id / last_club_slug는 변경하지 않는다.
 * FullSignOutButton과 달리 public 페이지로 redirect하지 않는다.
 */
export function AdminLogoutButton({
  className = "",
  label = "로그아웃",
}: AdminLogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleLogout}
      className={`font-semibold whitespace-nowrap transition-opacity hover:opacity-70 disabled:opacity-40 ${className}`}
      style={{ fontSize: "var(--shell-user-size, 11px)", color: "var(--admin-muted)" }}
    >
      {loading ? "로그아웃 중..." : label}
    </button>
  );
}
