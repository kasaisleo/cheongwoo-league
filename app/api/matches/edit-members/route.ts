import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { KAKAO_ADMIN_ROLES } from "@/lib/admin-permission-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 경기 수정 모달(EditMatchModal → PlayerSelector)에 필요한 회원 목록 조회 API.
 *
 * EditMatchModal은 Public 매치 페이지(admin_club_slug 쿠키 없이도 열릴 수 있음)의
 * MatchCard에서 렌더링되므로 admin_club_slug 쿠키에 의존하는
 * /api/admin/members-list를 쓸 수 없다 — 대신 요청받은 clubId에서 이 사용자가
 * 운영진(permission_role)인지 auth_user_id로 직접 검증한다.
 *
 * 허용 역할(KAKAO_ADMIN_ROLES)은 lib/admin-permission-types.ts의 공용 상수를
 * 그대로 쓴다 — getAdminAccessServer()/기존 매치 수정 권한과 다른 정책을
 * 만들지 않기 위함.
 *
 * members는 anon/authenticated GRANT가 회수되어(0037) 브라우저에서 직접
 * 조회할 수 없다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId || !UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createServiceClient();
  const { data: requester } = await admin
    .from("members")
    .select("permission_role")
    .eq("auth_user_id", user.id)
    .eq("club_id", clubId)
    .eq("is_active", true)
    .maybeSingle();

  if (!requester || !(KAKAO_ADMIN_ROLES as readonly string[]).includes(requester.permission_role)) {
    return NextResponse.json({ error: "운영진 권한이 필요합니다." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("members")
    .select("id, name, nickname")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[matches/edit-members]", error.code, error.message);
    return NextResponse.json({ error: "회원 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
