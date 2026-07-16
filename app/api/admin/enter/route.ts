import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

/**
 * GET /api/admin/enter?club=slug
 *
 * /c/[slug] 내부의 "관리자" 링크, admin-callback, AdminClubSelector가 이 경로를 거친다.
 * 요청한 club에서 Kakao admin 권한을 검증한 뒤 admin_club_slug 쿠키를 설정하고
 * /admin으로 redirect한다.
 *
 * 권한 실패 시:
 *   - 기존 admin_club_slug 쿠키를 삭제한다 (다른 클럽 context로 fallback 방지).
 *   - 카카오 세션이 있는 유저가 특정 클럽 권한이 없으면 /admin?no_access_club={slug}
 *   - 비로그인이거나 club이 없으면 /admin (로그인 화면)
 *
 * cw_admin_session 쿠키 기반 owner/manager 체크 제거. Kakao 단일 인증.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const clubSlugParam = searchParams.get("club");

  const adminHome = new URL("/admin", origin);

  if (!clubSlugParam) {
    return NextResponse.redirect(adminHome);
  }

  function redirectClearingCookie(target: URL): NextResponse {
    const response = NextResponse.redirect(target);
    response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  function redirectWithCookie(slug: string): NextResponse {
    const response = NextResponse.redirect(adminHome);
    response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return response;
  }

  try {
    const supabase = createClient();

    // 1) 클럽 존재 + active 확인
    const { data: club } = await supabase
      .from("clubs")
      .select("id, slug")
      .eq("slug", clubSlugParam)
      .eq("status", "active")
      .maybeSingle();

    if (!club) {
      return redirectClearingCookie(adminHome);
    }

    // 2) 카카오 admin 권한 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // members_select_all 삭제 이후에도 admin 진입 게이트가 끊기지 않도록
      // service-role로 조회한다.
      const supabaseAdmin = createServiceClient();
      const { data: member } = await supabaseAdmin
        .from("members")
        .select("id, permission_role")
        .eq("auth_user_id", user.id)
        .eq("club_id", club.id)
        .eq("is_active", true)
        .maybeSingle();

      if (member && (KAKAO_ADMIN_ROLES as readonly string[]).includes(member.permission_role)) {
        return redirectWithCookie(club.slug);
      }

      // 로그인 됐으나 이 club에 admin 권한 없음
      const noAccessTarget = new URL(`/admin?no_access_club=${encodeURIComponent(club.slug)}`, origin);
      return redirectClearingCookie(noAccessTarget);
    }

    // 비로그인
    return redirectClearingCookie(adminHome);
  } catch {
    return redirectClearingCookie(adminHome);
  }
}
