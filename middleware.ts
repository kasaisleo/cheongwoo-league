import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 세션 갱신 미들웨어.
 *
 * 모든 요청마다 Supabase auth 쿠키(access token / refresh token)를 갱신한다.
 * lib/supabase/server.ts의 set() 콜백이 서버 컴포넌트에서는 동작하지 않아
 * JWT 만료 후 getUser()가 null을 반환하는 문제를 방지한다.
 *
 * CENTER COURT(/center-court, /api/center-court) 및 정적 파일에는 적용하지 않는다.
 * admin cookie(cw_admin_session, admin_club_slug)는 이 미들웨어가 건드리지 않는다.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 갱신 (토큰 만료 시 refresh token으로 자동 갱신)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * 미들웨어 적용 대상: 웹 페이지 라우트만.
     *
     * 제외 대상:
     *   _next/static  — 번들/청크 파일
     *   _next/image   — 이미지 최적화 요청
     *   favicon.ico   — 파비콘
     *   api/          — 모든 API 라우트 (아래 근거 참조)
     *   center-court  — CENTER COURT 페이지/API (완전 격리)
     *   정적 자산 확장자 — public/ 폴더 이미지·폰트·아이콘
     *
     * ## API 라우트 제외 근거
     *
     * Next.js App Router에서 Route Handler는 `cookies().set()`을 직접 호출할 수
     * 있다 (서버 컴포넌트와 달리 예외 없음). 따라서 API 라우트 내부의
     * createClient() → auth.getUser() 흐름이 refresh token 갱신 후 자동으로
     * Set-Cookie 헤더를 응답에 포함시킨다.
     *
     * 미들웨어가 API 라우트에 적용될 경우:
     *   - OAuth callback (/auth/callback): code 교환 전 getUser()가 null 반환하여
     *     무해하지만, 불필요한 Supabase API 호출이 추가된다.
     *   - 파일 업로드 (/api/members/import/upload): multipart stream 처리 전
     *     getUser() 네트워크 호출로 지연이 발생할 수 있다.
     *   - 외부 webhook 수신 경로: 인증 쿠키가 없어 getUser()는 null이지만
     *     불필요한 부작용 가능성을 완전히 차단한다.
     *
     * 세션 갱신이 필요한 대상은 오직 서버 컴포넌트 페이지 렌더 — 미들웨어를
     * 페이지 라우트로 한정해도 보안 목적이 완전히 달성된다.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|center-court|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
