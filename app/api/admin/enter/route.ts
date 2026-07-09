import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

/**
 * GET /api/admin/enter?club=slug
 *
 * /c/[slug] 내부의 "관리자" 링크가 이 Route Handler를 거친다.
 * 요청한 club에서 admin 권한을 검증한 뒤 admin_club_slug 쿠키를 설정하고
 * /admin 으로 redirect한다.
 *
 * - 권한 없으면: 쿠키 설정 없이 /admin 으로 redirect (로그인/권한없음 화면)
 * - club query 없으면: 쿠키 설정 없이 /admin 으로 redirect
 * - club이 존재하지 않으면: /admin 으로 redirect
 *
 * 이 경로를 거쳐야만 admin_club_slug 쿠키가 갱신된다.
 * 공개 페이지의 selected_club_id 와 완전히 분리되어 있다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const clubSlugParam = searchParams.get("club");

  const adminTarget = new URL("/admin", origin);

  if (!clubSlugParam) {
    return NextResponse.redirect(adminTarget);
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
      return NextResponse.redirect(adminTarget);
    }

    // 2) 카카오 admin 권한 확인
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
        const response = NextResponse.redirect(adminTarget);
        response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, club.slug, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        });
        return response;
      }
    }

    // 3) cookie admin (cw_admin_session) 은 club 단위 검증 없이 허용
    //    (owner/manager 비밀번호 로그인은 전통적으로 청우회 전용이었으나
    //     admin_club_slug 쿠키를 통해 명시적으로 선택한 club으로 context 설정)
    const cookieRole = getAdminRole();
    if (cookieRole === "owner" || cookieRole === "manager") {
      const response = NextResponse.redirect(adminTarget);
      response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, club.slug, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
      return response;
    }

    // 권한 없음 → 쿠키 설정 없이 /admin (로그인/권한없음 화면)
    return NextResponse.redirect(adminTarget);
  } catch {
    return NextResponse.redirect(adminTarget);
  }
}
