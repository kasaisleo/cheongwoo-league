"use client";

import { PublicKakaoLoginButton } from "@/components/auth/PublicKakaoLoginButton";

interface Props {
  /** auth 확인 중 skeleton 표시 */
  checking?: boolean;
  /** 로그인 완료 후 복귀할 내부 경로 (e.g. /c/namaste/mypage) */
  returnUrl?: string;
}

/**
 * ClubMemberLoginGate — /c/[slug]/mypage 전용 단일 로그인 게이트.
 *
 * checking: auth 확인 중 → 동일 layout position에 skeleton indicator
 * unauthenticated: 비로그인 → PublicKakaoLoginButton (직접 OAuth, /login 우회)
 *
 * - club skin CSS token 사용 (text-clay-400, --club-button-radius)
 * - /login 중간 페이지 거치지 않음 → 클릭 즉시 Kakao OAuth 시작
 * - admin /auth/admin-callback과 완전히 분리
 * - 모든 상태가 동일한 min-height/position 유지 → layout shift 없음
 */
export function ClubMemberLoginGate({ checking = false, returnUrl = "/" }: Props) {
  return (
    <main className="flex min-h-[55vh] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs text-center">
        <p className="eyebrow-en text-clay-400 mb-1">My Page</p>
        <h1 className="headline-kr text-3xl text-line-900 mb-3">마이페이지</h1>

        {checking ? (
          <div className="mb-6 text-sm text-line-400">확인 중...</div>
        ) : (
          <p className="mb-6 text-sm text-line-500">
            회원 정보 확인을 위해 로그인이 필요합니다.
          </p>
        )}

        {checking ? (
          /* 버튼 자리 skeleton — 높이 고정으로 layout shift 방지 */
          <div
            className="h-12 w-full"
            style={{
              background: "rgba(254,229,0,0.15)",
              borderRadius: "var(--club-button-radius, 6px)",
            }}
            aria-hidden
          />
        ) : (
          <PublicKakaoLoginButton
            returnUrl={returnUrl}
            style={{ borderRadius: "var(--club-button-radius, 6px)" }}
            className="flex h-12 w-full items-center justify-center gap-2 bg-[#FEE500] text-sm font-bold text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-50"
          />
        )}
      </div>
    </main>
  );
}
