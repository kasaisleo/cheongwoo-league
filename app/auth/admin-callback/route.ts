import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;
const ADMIN_CLUB_SLUG_MAX_AGE = 60 * 60 * 8; // 8h

/**
 * GET /auth/admin-callback
 *
 * Admin 전용 OAuth 콜백. public /auth/callback과 완전히 분리된다.
 *
 * 처리 순서:
 *   1. code → Supabase 세션 교환
 *   2. auth_user_id 기준으로 permission_role이 운영진인 members 전체 조회
 *   3. 해당 members의 club_id 중 clubs.status='active'인 것만 필터
 *   4. 0개 → /admin?no_access=1
 *   5. 1개 → admin_club_slug 쿠키 설정 후 /admin (club 진입)
 *   6. 2개+ → /admin (쿠키 없음, gateway에서 클럽 선택 UI 표시)
 *
 * public selected_club_id 쿠키를 건드리지 않는다.
 * public /c/[slug]/mypage 등으로 리다이렉트하지 않는다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const adminGate = new URL("/admin", origin);
  const noAccess  = new URL("/admin?no_access=1", origin);

  if (!code) {
    return NextResponse.redirect(new URL("/admin?error=no_code", origin));
  }

  try {
    const supabase = createClient();
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !exchangeData.session) {
      return NextResponse.redirect(new URL("/admin?error=exchange_failed", origin));
    }

    const user = exchangeData.session.user;
    const supabaseAdmin = createServiceClient();

    // 2) 이 user의 운영진 member 후보를 전부 조회
    const { data: adminMembers } = await supabaseAdmin
      .from("members")
      .select("club_id, permission_role")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("permission_role", KAKAO_ADMIN_ROLES);

    const candidateClubIds = Array.from(
      new Set(
        (adminMembers ?? [])
          .map((m) => m.club_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    // 3) 후보 club 중 status='active'인 것만
    let activeAdminClubs: Array<{ id: string; slug: string }> = [];
    if (candidateClubIds.length > 0) {
      const { data: clubs } = await supabaseAdmin
        .from("clubs")
        .select("id, slug")
        .in("id", candidateClubIds)
        .eq("status", "active");
      activeAdminClubs = clubs ?? [];
    }

    // 4) 운영진 클럽 없음
    if (activeAdminClubs.length === 0) {
      return NextResponse.redirect(noAccess);
    }

    // 5) 단일 클럽: admin_club_slug 직접 세팅 후 /admin
    if (activeAdminClubs.length === 1) {
      const response = NextResponse.redirect(adminGate);
      response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, activeAdminClubs[0].slug, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ADMIN_CLUB_SLUG_MAX_AGE,
      });
      return response;
    }

    // 6) 복수 클럽: 쿠키 없이 /admin → gateway에서 클럽 선택
    return NextResponse.redirect(adminGate);
  } catch {
    return NextResponse.redirect(new URL("/admin?error=callback_error", origin));
  }
}
