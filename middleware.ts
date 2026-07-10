import { NextRequest, NextResponse } from "next/server";

// 운영진 인증이 필요한 경로 (경기 입력, 회원/게스트 등록, 명단 가져오기 등 쓰기 작업)
const PROTECTED_PREFIXES: string[] = [];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (needsAuth) {
    const hasSession = request.cookies.has("cw_admin_session");
    if (!hasSession) {
      const loginUrl = new URL("/admin", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // root layout에서 /admin·/center-court 경로 감지에 사용
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
