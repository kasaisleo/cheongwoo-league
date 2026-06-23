import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";

/**
 * 클라이언트 컴포넌트는 쿠키 기반 운영진 세션을 직접 확인할 수 없으므로,
 * 이 API를 통해 "현재 운영진으로 로그인되어 있는지"만 가볍게 조회한다.
 * 카카오 로그인 + permission_role이 도입되면, 이 응답에 permissionRole을
 * 함께 내려주는 방식으로 확장할 수 있다.
 */
export async function GET() {
  return NextResponse.json({ isAdmin: isAdminSession() });
}
