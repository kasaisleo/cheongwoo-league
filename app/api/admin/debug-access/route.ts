import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;

/**
 * GET /api/admin/debug-access
 * GET /api/admin/debug-access?club=namaste
 *
 * 서버 기준 권한 상태 진단용 API.
 * ?club=slug 를 전달하면 해당 클럽 기준으로도 검사한다.
 * 민감정보 미노출 — 권한 판정 흐름만 반환.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedClubSlug = searchParams.get("club") ?? null;

  const supabase = createClient();
  const cookieStore = cookies();

  // 현재 admin_club_slug 쿠키
  const adminClubSlugCookie = cookieStore.get(ADMIN_CLUB_SLUG_COOKIE)?.value ?? null;

  // 1. Supabase Auth user
  let hasUser = false;
  let userIdPrefix: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    hasUser = !!user;
    userIdPrefix = user ? `${user.id.slice(0, 8)}…` : null;
  } catch { /* 무시 */ }

  // 3. 이 user의 모든 admin 클럽 조회
  let adminClubs: Array<{ slug: string; name: string; role: string }> = [];
  if (hasUser) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // RLS가 club_id 없는 전체 조회를 차단할 수 있으므로 service client 사용
      const supabaseAdmin = createServiceClient();
      if (user) {
        const { data: adminMembers } = await supabaseAdmin
          .from("members")
          .select("permission_role, club_id")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .in("permission_role", KAKAO_ADMIN_ROLES);

        if (adminMembers && adminMembers.length > 0) {
          const clubIds = adminMembers.map((m) => m.club_id).filter(Boolean) as string[];
          const { data: clubs } = await supabase
            .from("clubs")
            .select("id, slug, name")
            .in("id", clubIds)
            .eq("status", "active");

          const clubMap = new Map((clubs ?? []).map((c) => [c.id, c]));
          adminClubs = adminMembers
            .filter((m) => clubMap.has(m.club_id))
            .map((m) => {
              const c = clubMap.get(m.club_id)!;
              return { slug: c.slug, name: c.name, role: m.permission_role };
            });
        }
      }
    } catch { /* 무시 */ }
  }

  // 4. ?club= 기준 검사 (있으면)
  let requestedClubFound = false;
  let hasAdminInRequestedClub = false;
  let requestedClubIdPrefix: string | null = null;
  let memberRoleInRequested: string | null = null;
  let memberActiveInRequested: boolean | null = null;
  let requestedReason = "not_checked";

  if (requestedClubSlug) {
    try {
      const { data: club } = await supabase
        .from("clubs")
        .select("id, slug")
        .eq("slug", requestedClubSlug)
        .eq("status", "active")
        .maybeSingle();

      if (!club) {
        requestedReason = "requested_club_not_found";
      } else {
        requestedClubFound = true;
        requestedClubIdPrefix = `${club.id.slice(0, 8)}…`;

        if (!hasUser) {
          requestedReason = "no_supabase_user";
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: member } = await supabase
              .from("members")
              .select("permission_role, is_active")
              .eq("auth_user_id", user.id)
              .eq("club_id", club.id)
              .maybeSingle();

            if (!member) {
              requestedReason = "not_member_of_requested_club";
            } else {
              memberRoleInRequested = member.permission_role;
              memberActiveInRequested = member.is_active;

              if (!member.is_active) {
                requestedReason = "member_not_active";
              } else if (!(KAKAO_ADMIN_ROLES as readonly string[]).includes(member.permission_role)) {
                requestedReason = "role_not_in_admin_list";
              } else {
                requestedReason = "should_be_admin";
                hasAdminInRequestedClub = true;
              }
            }
          }
        }
      }
    } catch { /* 무시 */ }
  }

  // 5. 실제 getAdminAccessServer() 결과
  const access = await getAdminAccessServer();

  // 6. reason 종합
  let overallReason = "unknown";
  if (!hasUser) overallReason = "no_supabase_user";
  else if (adminClubs.length === 0) overallReason = "no_admin_members";
  else if (!adminClubSlugCookie && adminClubs.length === 1) overallReason = "single_admin_club_needs_enter";
  else if (!adminClubSlugCookie && adminClubs.length > 1) overallReason = "multiple_admin_clubs_require_selection";
  else if (access.isAdmin) overallReason = "should_be_admin";
  else overallReason = "check_admin_club_slug_cookie";

  // requestedClubSlug vs resolvedAccessClubSlug 불일치 감지
  const contextMismatch =
    requestedClubSlug !== null &&
    access.clubSlug !== null &&
    requestedClubSlug !== access.clubSlug;

  return NextResponse.json({
    // 전체 요약
    isAdmin: access.isAdmin,
    isOwner: access.isOwner,
    overallReason,
    contextMismatch,

    // 유저 상태
    hasUser,
    userIdPrefix,

    // admin_club_slug 쿠키 현황
    adminClubSlugCookie,

    // 이 user의 admin 클럽 목록
    adminClubCount: adminClubs.length,
    adminClubs,

    // getAdminAccessServer() 결과
    resolvedAccessClubSlug: access.clubSlug,
    resolvedAccessClubIdPrefix: access.clubId ? `${access.clubId.slice(0, 8)}…` : null,
    accessSource: access.source,

    // ?club= 기준 검사 (있을 때만)
    ...(requestedClubSlug !== null && {
      requestedClubSlug,
      requestedClubFound,
      requestedClubIdPrefix,
      hasAdminInRequestedClub,
      memberRoleInRequested,
      memberActiveInRequested,
      requestedReason,
    }),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
