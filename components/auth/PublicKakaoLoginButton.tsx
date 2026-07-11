"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { startPublicKakaoLogin } from "@/lib/auth/public-kakao-login";

interface Props {
  /** 로그인을 시작하는 클럽의 slug. 필수. */
  clubSlug: string;
  /** 로그인 완료 후 복귀할 내부 경로. 생략 시 `/c/${clubSlug}/mypage`. */
  returnPath?: string;
  style?: CSSProperties;
  className?: string;
  /** 버튼 라벨. 생략 시 기본 문구("카카오로 로그인" / 로딩 중 "이동 중..."). */
  children?: ReactNode;
}

/**
 * PublicKakaoLoginButton — public 회원 전용 Kakao OAuth 시작 공통 컴포넌트.
 *
 * 모든 public 로그인 진입점(헤더, mypage 게이트, /login, 출석 guest CTA)이
 * 이 컴포넌트 하나만 쓴다. 클릭 즉시 signInWithOAuth를 호출한다 —
 * 중간 페이지를 거치지 않는다. callback은 공통 public `/auth/callback` 고정.
 * admin `/auth/admin-callback`과 완전히 분리.
 */
export function PublicKakaoLoginButton({ clubSlug, returnPath, style, className, children }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const result = await startPublicKakaoLogin(supabase, { clubSlug, returnPath });

    if (result.error) {
      setLoading(false);
      setError(result.error);
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
        {children ?? (loading ? "이동 중..." : "카카오로 로그인")}
      </button>
      {error && <p className="mt-2 text-center text-xs text-fault-400">{error}</p>}
    </div>
  );
}
