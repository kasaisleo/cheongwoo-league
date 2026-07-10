"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Admin 전용 카카오 OAuth 버튼.
 *
 * public /login 페이지를 거치지 않고 직접 Supabase OAuth를 시작한다.
 * redirectTo = /auth/admin-callback → admin-specific callback으로 복귀.
 *
 * public /auth/callback, public selected_club_id와 완전히 분리.
 */
export function AdminKakaoLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/admin-callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: callbackUrl,
        scopes: "profile_nickname profile_image",
      },
    });

    if (oauthError) {
      setLoading(false);
      setError("카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
    // 성공 시 OAuth provider 페이지로 이동 — 이후 rendering 없음
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleLogin}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-[#FEE500] text-sm font-bold text-[#191600] transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <span className="text-[#191600]/60">카카오로 이동 중...</span>
        ) : (
          <>
            <span>카카오로 로그인</span>
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
