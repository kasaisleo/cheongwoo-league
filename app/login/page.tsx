"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

/**
 * 일반 회원용 카카오 로그인 진입점.
 *
 * 변경 (리다이렉트 정책 수정):
 *   이미 카카오 세션이 있는 사용자가 /login에 접근하면 "/"로 이동.
 *   세션 확인 중에는 로딩 상태로 처리해 레이아웃 깜빡임 방지.
 *
 * 로그인 플로우 (신규):
 *   카카오 동의 → /auth/callback → members.auth_user_id 연결 확인
 *     → 연결됨: "/"
 *     → 미연결: "/auth/pending"
 *
 * admin-auth.ts와 완전히 분리 — 이 파일은 admin-auth.ts를 참조하지 않음.
 */
export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);  // 세션 확인 중 로딩
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인된 세션이 있으면 "/" 로 이동
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  async function handleKakaoLogin() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "profile_nickname profile_image",
      },
    });

    if (oauthError) {
      setLoading(false);
      setError("카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  // 세션 확인 중 — 빈 화면으로 깜빡임 방지
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
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="eyebrow-en text-clay-400">Mapo Cheongwoo Club</p>
        </div>
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
