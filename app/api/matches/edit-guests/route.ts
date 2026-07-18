import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { KAKAO_ADMIN_ROLES } from "@/lib/admin-permission-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 경기 수정 모달(EditMatchModal → PlayerSelector)에 필요한 게스트 후보 조회 API.
 * app/api/matches/edit-members/route.ts와 동일한 이유로 존재한다 —
 * EditMatchModal은 Public 매치 페이지(admin_club_slug 쿠키 없이도 열릴 수 있음)의
 * MatchCard에서 렌더링되므로, 요청받은 clubId에서 이 사용자가 운영진인지
 * auth_user_id로 직접 검증한다.
 *
 * 허용 역할(KAKAO_ADMIN_ROLES)은 lib/admin-permission-types.ts의 공용 상수를
 * 그대로 쓴다 — edit-members와 다른 권한 정책을 만들지 않기 위함.
 *
 * guests는 anon/authenticated GRANT가 없으므로(guests P0) 브라우저에서
 * 직접 조회할 수 없다.
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

  // 기존 EditMatchModal의 직접 조회 필터를 그대로 유지한다:
  // club_id 스코프 + 정회원 미전환(converted_to_member_id is null) + created_at desc.
  // is_active 필터는 원래도 없었다 — 비활성 게스트도 과거 매치 편집 시 후보에 남아야 한다.
  const { data, error } = await admin
    .from("guests")
    .select("id, name")
    .eq("club_id", clubId)
    .is("converted_to_member_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[matches/edit-guests]", error.code, error.message);
    return NextResponse.json({ error: "게스트 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ guests: data ?? [] });
}
