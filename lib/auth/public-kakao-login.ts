import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * lib/auth/public-kakao-login.ts — public 회원 Kakao OAuth 시작 공통 helper.
 *
 * 모든 public 로그인 진입점(헤더, mypage 게이트, /login, 출석 guest CTA 등)이
 * 이 helper 하나만 호출한다. admin(/auth/admin-callback)과는 완전히 분리.
 *
 * 정책:
 *   - clubSlug 필수 — selected_club_id 쿠키만으로 club context를 결정하지 않는다.
 *   - returnPath는 내부 canonical path만 허용, /admin·/center-court·/demo는 거부.
 *   - 기본 returnPath는 `/c/${clubSlug}/mypage`.
 *   - callback은 public 공통 `/auth/callback` 고정 사용.
 */

const BLOCKED_RETURN_PREFIXES = ["/admin", "/center-court", "/demo"];

/** 내부 canonical path인지 검증한다. 외부 URL·프로토콜 상대 URL·차단 prefix는 거부. */
function isSafeReturnPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return !BLOCKED_RETURN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * returnPath를 검증해 안전한 최종 경로를 만든다.
 * - 없거나 안전하지 않으면 `/c/${clubSlug}/mypage`로 폴백.
 * - `/c/{다른slug}/...`처럼 clubSlug와 불일치하는 경로는 거부(다른 클럽 returnUrl 생성 방지).
 */
export function resolvePublicReturnPath(clubSlug: string, returnPath?: string): string {
  const fallback = `/c/${clubSlug}/mypage`;
  if (!returnPath) return fallback;
  if (!isSafeReturnPath(returnPath)) return fallback;

  const slugMatch = returnPath.match(/^\/c\/([^/?#]+)/);
  if (slugMatch && slugMatch[1] !== clubSlug) return fallback;

  return returnPath;
}

export interface StartPublicKakaoLoginParams {
  /** 로그인을 시작하는 클럽의 slug. 필수 — 생략 시 호출 자체가 컴파일 에러. */
  clubSlug: string;
  /** 로그인 완료 후 복귀할 내부 경로. 생략 시 `/c/${clubSlug}/mypage`. */
  returnPath?: string;
}

export interface StartPublicKakaoLoginResult {
  error: string | null;
}

/**
 * Kakao OAuth를 시작한다. 성공 시 브라우저가 Kakao로 리다이렉트되므로
 * 별도 후속 처리가 없다 — 실패 시에만 에러 메시지를 반환한다.
 */
export async function startPublicKakaoLogin(
  supabase: SupabaseClient,
  { clubSlug, returnPath }: StartPublicKakaoLoginParams
): Promise<StartPublicKakaoLoginResult> {
  if (!clubSlug) {
    return { error: "클럽 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요." };
  }

  const safeReturn = resolvePublicReturnPath(clubSlug, returnPath);
  const callbackUrl = `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(safeReturn)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: callbackUrl,
      scopes: "profile_nickname profile_image",
    },
  });

  if (error) {
    return { error: "카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요." };
  }
  return { error: null };
}
