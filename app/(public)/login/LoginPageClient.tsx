"use client";

import { Card } from "@/components/ui/Card";
import { formatClubEyebrow } from "@/lib/club-display";
import { PublicKakaoLoginButton } from "@/components/auth/PublicKakaoLoginButton";

/**
 * 일반 회원용 카카오 로그인 폼.
 *
 * 이미 로그인된 사용자 리다이렉트 / returnUrl 안전 검증은 서버 wrapper인
 * app/login/page.tsx가 담당한다(QA-P1-D) — 이 컴포넌트가 렌더링된다는
 * 것 자체가 이미 "로그인되지 않은 상태"임을 서버가 보장하므로, 여기서는
 * 세션을 다시 확인하지 않는다. safeReturn은 서버에서 이미 검증된 값을
 * 그대로 prop으로 받는다.
 *
 * OAuth 시작 로직은 PublicKakaoLoginButton(공통 helper) 하나만 사용 —
 * 이 파일에서 signInWithOAuth를 직접 호출하지 않는다.
 */
interface LoginPageClientProps {
  returnUrl: string;
  currentClubSlug: string;
}

export default function LoginPageClient({ returnUrl, currentClubSlug }: LoginPageClientProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-clay-400/30 p-6">
        <p className="eyebrow-en text-clay-400">{formatClubEyebrow(currentClubSlug)}</p>
        <h1 className="headline-kr mt-1 text-2xl text-line-900">회원 로그인</h1>
        <p className="mt-1 text-sm text-line-500">
          카카오 계정으로 로그인하면 내 회원 정보를 확인할 수 있어요.
        </p>

        <PublicKakaoLoginButton
          clubSlug={currentClubSlug}
          returnPath={returnUrl}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-sm font-bold text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-50"
        />
      </Card>
    </main>
  );
}
