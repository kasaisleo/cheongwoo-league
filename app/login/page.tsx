"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

/**
 * 일반 회원용 카카오 로그인 진입점. /admin(운영진 비밀번호 로그인)과는
 * 완전히 분리된 별개의 인증 흐름이다 — Step 10 설계 결정에 따라 관리자
 * 인증(lib/admin-auth.ts)과 회원 인증(Supabase Auth + 카카오)을 당분간
 * 분리해서 운영한다. 이 페이지는 admin-auth.ts를 전혀 참조하지 않는다.
 *
 * 로그인 흐름: 카카오 동의 화면 → /auth/callback(서버)에서 세션 교환 및
 * members.auth_user_id 연결 여부 확인 → 결과에 따라 "/" 또는
 * "/auth/pending"으로 이동(이번 Step에서는 전화번호 자동 매칭을 하지 않음).
 */
export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // 성공 시 카카오 동의 화면으로 리다이렉트되므로 여기서 추가로 할 일은 없다.
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-clay-400/30 p-6">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Mapo Cheongwoo Club
          </p>
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-line-900">
          회원 로그인
        </h1>
        <p className="mt-1 text-sm text-line-500">카카오 계정으로 로그인하면 내 회원 정보를 확인할 수 있어요.</p>

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
