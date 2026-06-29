import { NextResponse } from "next/server";
import { getAdminRole } from "@/lib/admin-auth";

/**
 * 클라이언트 컴포넌트는 쿠키 기반 운영진 세션을 직접 확인할 수 없으므로,
 * 이 API를 통해 "현재 운영진으로 로그인되어 있는지"와 "어떤 역할인지"를
 * 가볍게 조회한다. isAdmin은 Step 8-3 이전부터 있던 필드라 그대로 유지하고
 * (useIsAdmin() 등 기존 클라이언트 코드가 이 필드만 본다), role은 신규로
 * 추가한 필드다(owner 전용 UI 분기에 사용 — useAdminRole() 참고).
 *
 * 카카오 로그인 + permission_role이 도입되면, role의 출처만 쿠키 검증에서
 * DB의 permission_role 조회로 바뀌고 이 응답 형식은 그대로 유지될 수 있다.
 */
export async function GET() {
  const role = getAdminRole();
  return NextResponse.json({ isAdmin: role !== null, role });
}
