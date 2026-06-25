import { NextRequest, NextResponse } from "next/server";

// 운영진 인증이 필요한 경로 (경기 입력, 회원/게스트 등록, 명단 가져오기 등 쓰기 작업)
const PROTECTED_PREFIXES = ["/matches/new", "/members/new", "/members/import", "/guests/new"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("cw_admin_session");
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/matches/new", "/members/new", "/members/import", "/guests/new"],
};
