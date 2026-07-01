"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

/**
 * 일반 회원용 카카오 로그인 진입점.
 *
 * returnUrl 지원:
 *   /login?returnUrl=/mypage → 로그인 성공 후 /mypage 복귀
 *   returnUrl은 /auth/callback의 redirectTo state로 전달됨.
 *
 * 보안: returnUrl은 같은 origin 내부 경로만 허용 (외부 URL redirect 방지).
 */
function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "";
  // 같은 origin 내부 경로만 허용 — 절대 URL이나 외부 도메인 차단
  const safeReturn = returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/";

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인된 세션이 있으면 returnUrl 또는 "/"로 이동
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(safeReturn || "/");
      } else {
        setChecking(false);
      }
    });
  }, [router, safeReturn]);

  async function handleKakaoLogin() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // returnUrl을 /auth/callback의 state 파라미터로 전달
    // Supabase는 redirectTo에 붙은 쿼리를 그대로 콜백 URL에 포함시킨다
    const callbackUrl = safeReturn
      ? `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(safeReturn)}`
      : `${window.location.origin}/auth/callback`;

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
  }

  if (checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <p className="text-sm text-line-500">확인 중...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-clay-400/30 p-6">
        <p className="eyebrow-en text-clay-400">Mapo Cheongwoo Club</p>
        <h1 className="headline-kr mt-1 text-2xl text-line-900">회원 로그인</h1>
        <p className="mt-1 text-sm text-line-500">
          카카오 계정으로 로그인하면 내 회원 정보를 확인할 수 있어요.
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={handleKakaoLogin}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-sm font-bold text-[#191600] transition-opacity disabled:opacity-50"
        >
          {loading ? "이동 중..." : "카카오로 로그인"}
        </button>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-line-500">확인 중...</p>
      </main>
    }>
      <LoginInner />
    </Suspense>
  );
}
