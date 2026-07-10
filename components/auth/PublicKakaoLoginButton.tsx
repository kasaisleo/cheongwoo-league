"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** 로그인 완료 후 복귀할 내부 경로 (e.g. /c/namaste/mypage) */
  returnUrl: string;
  /** --club-button-radius CSS var 기반 radius */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * PublicKakaoLoginButton — 공개 회원 전용 직접 OAuth 버튼.
 *
 * /login 중간 페이지를 거치지 않고 signInWithOAuth를 바로 호출한다.
 * callback은 기존 public /auth/callback을 사용.
 * admin /auth/admin-callback과 완전히 분리.
 */
export function PublicKakaoLoginButton({ returnUrl, style, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`;

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
    // 성공 시 카카오로 redirect되므로 loading은 자연히 유지됨
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleLogin}
        className={
          className ??
          "flex h-12 w-full items-center justify-center gap-2 bg-[#FEE500] text-sm font-bold text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-50"
        }
        style={style}
      >
        {loading ? "이동 중..." : "카카오로 로그인"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-fault-400">{error}</p>}
    </div>
  );
}
