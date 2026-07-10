import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getManagerAllowedSlugs, ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

/**
 * GET /api/admin/enter?club=slug
 *
 * /c/[slug] 내부의 "관리자" 링크가 이 Route Handler를 거친다.
 * 요청한 club에서 admin 권한을 검증한 뒤 admin_club_slug 쿠키를 설정하고
 * /admin 으로 redirect한다.
 *
 * 권한 실패 시:
 *   - 기존 admin_club_slug 쿠키를 삭제한다 (다른 클럽 context로 fallback 방지).
 *   - 카카오 세션이 있는 유저가 특정 클럽 권한이 없으면 /admin?no_access_club={slug}
 *     로 redirect하여 해당 클럽 권한 없음 화면을 표시한다.
 *   - 비로그인이거나 club이 없으면 /admin 으로 redirect (로그인 화면).
 *
 * 이 경로를 거쳐야만 admin_club_slug 쿠키가 갱신된다.
 * 공개 페이지의 selected_club_id 와 완전히 분리되어 있다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const clubSlugParam = searchParams.get("club");

  const adminHome = new URL("/admin", origin);

  // club query 없음 → 쿠키 건드리지 않고 /admin
  if (!clubSlugParam) {
    return NextResponse.redirect(adminHome);
  }

  /** 기존 admin_club_slug 쿠키를 삭제한 채로 target URL로 redirect */
  function redirectClearingCookie(target: URL): NextResponse {
    const response = NextResponse.redirect(target);
    response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  /** 성공: admin_club_slug 쿠키를 설정한 채로 /admin redirect */
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
      // club 자체가 없음 → 쿠키 삭제 후 /admin (로그인 화면)
      return redirectClearingCookie(adminHome);
    }

    // 2) cookie admin (cw_admin_session) 을 먼저 확인 — 서버 비밀번호 기반이므로 우선순위 높음.
    //    Kakao 공개 세션이 있어도 Owner/Manager 쿠키가 있으면 진입 허용한다.
    const cookieRole = getAdminRole();

    if (cookieRole === "owner") {
      // Owner: 모든 active club 접근 가능 (이미 위에서 club 존재+active 확인 완료)
      return redirectWithCookie(club.slug);
    }

    if (cookieRole === "manager") {
      // Manager: fail-closed — MANAGER_CLUB_SLUGS에 명시된 slug만 허용.
      // 미설정(빈 배열)이면 모든 클럽 접근 거부.
      const allowedSlugs = getManagerAllowedSlugs();
      if (allowedSlugs.length === 0) {
        // 설정 누락 — production 로그로 식별 가능하게 기록 (민감 정보 제외)
        console.error("[admin/enter] Manager session active but MANAGER_CLUB_SLUGS is not configured or empty. Denying all club access.");
        return redirectClearingCookie(adminHome);
      }
      if (!allowedSlugs.includes(club.slug.toLowerCase())) {
        console.error(`[admin/enter] Manager denied: club '${club.slug}' not in MANAGER_CLUB_SLUGS allowlist.`);
        const noAccessTarget = new URL(`/admin?no_access_club=${encodeURIComponent(club.slug)}`, origin);
        return redirectClearingCookie(noAccessTarget);
      }
      return redirectWithCookie(club.slug);
    }

    // 3) 카카오 admin 권한 확인 (cookie admin 없을 때만)
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: member } = await supabase
        .from("members")
        .select("id, permission_role")
        .eq("auth_user_id", user.id)
        .eq("club_id", club.id)
        .eq("is_active", true)
        .maybeSingle();

      if (member && (KAKAO_ADMIN_ROLES as readonly string[]).includes(member.permission_role)) {
        // 성공: 해당 club의 admin 권한 있음
        return redirectWithCookie(club.slug);
      }

      // 로그인 됐으나 이 club에 admin 권한 없음:
      // 기존 쿠키를 삭제하고 권한 없음 화면으로 redirect
      const noAccessTarget = new URL(`/admin?no_access_club=${encodeURIComponent(club.slug)}`, origin);
      return redirectClearingCookie(noAccessTarget);
    }

    // 비로그인 상태 → 쿠키 삭제 후 /admin (로그인 화면)
    return redirectClearingCookie(adminHome);
  } catch {
    return redirectClearingCookie(adminHome);
  }
}
