import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ADMIN_CLUB_SLUG_COOKIE, type AdminRole } from "@/lib/admin-auth";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;

/**
 * GET /api/auth/status
 *
 * 클라이언트 컴포넌트에서 현재 운영진 세션을 확인할 때 사용.
 * cw_admin_session 쿠키 제거 후, Supabase Kakao 세션 기반으로 재작성.
 *
 * 응답: { isAdmin: boolean, role: "owner" | "manager" | null }
 *   role 매핑: "master" → "owner", "admin"|"manager" → "manager"
 *   isAdmin = role !== null
 *
 * 클럽 컨텍스트:
 *   admin_club_slug 쿠키 있음 → 해당 club에서 permission_role 조회
 *   없음 → user의 전체 admin 멤버십 중 최고 role 반환
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ isAdmin: false, role: null });
    }

    const cookieStore = cookies();
    const adminSlug = cookieStore.get(ADMIN_CLUB_SLUG_COOKIE)?.value ?? null;

    let permissionRole: string | null = null;

    if (adminSlug) {
      // 선택된 클럽에서만 조회
      const { data: club } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", adminSlug)
        .eq("status", "active")
        .maybeSingle();

      if (club) {
        const { data: member } = await supabase
          .from("members")
          .select("permission_role")
          .eq("auth_user_id", user.id)
          .eq("club_id", club.id)
          .eq("is_active", true)
          .maybeSingle();

        if (member && (KAKAO_ADMIN_ROLES as readonly string[]).includes(member.permission_role)) {
          permissionRole = member.permission_role;
        }
      }
    } else {
      // 전체 클럽에서 최고 role 확인
      const supabaseAdmin = createServiceClient();
      const { data: members } = await supabaseAdmin
        .from("members")
        .select("permission_role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .in("permission_role", KAKAO_ADMIN_ROLES);

      if (members && members.length > 0) {
        // master > admin > manager 우선순위
        if (members.some((m) => m.permission_role === "master")) {
          permissionRole = "master";
        } else if (members.some((m) => m.permission_role === "admin")) {
          permissionRole = "admin";
        } else {
          permissionRole = "manager";
        }
      }
    }

    // DB role → AdminRole 매핑
    const role: AdminRole | null =
      permissionRole === "master" ? "owner" :
      permissionRole === "admin" || permissionRole === "manager" ? "manager" :
      null;

    return NextResponse.json({ isAdmin: role !== null, role });
  } catch {
    return NextResponse.json({ isAdmin: false, role: null });
  }
}
