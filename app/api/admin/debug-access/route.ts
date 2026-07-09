import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-auth";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * GET /api/admin/debug-access
 *
 * 서버 기준 권한 상태 진단용 API.
 * 민감정보 미노출 — 권한 판정 흐름만 반환.
 *
 * 권한: 오너 전용이지만 판정 실패 시에도 기본 진단 정보는 반환.
 */
export async function GET() {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();

  // 1. cw_admin_session 쿠키
  let cookieRole: string | null = null;
  try { cookieRole = getAdminRole(); } catch { /* 없음 */ }

  // 2. Supabase Auth user
  let hasUser = false;
  let userIdPrefix: string | null = null;
  let userError: string | null = null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    hasUser = !!user;
    userIdPrefix = user ? `${user.id.slice(0, 8)}…` : null;
    userError = error?.message ?? null;
  } catch (e) {
    userError = String(e);
  }

  // 3. members 조회 (auth_user_id + club_id 기준)
  let matchedMember = false;
  let permissionRole: string | null = null;
  let isActive: boolean | null = null;
  let clubIdFromMember: string | null = null;
  let memberQueryError: string | null = null;
  let clubSlug: string | null = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: member, error: mErr } = await supabase
        .from("members")
        .select("id, permission_role, is_active, club_id")
        .eq("auth_user_id", user.id)
        .eq("club_id", currentClubId)
        .maybeSingle();

      memberQueryError = mErr?.message ?? null;
      if (member) {
        matchedMember = true;
        permissionRole = member.permission_role;
        isActive = member.is_active;
        clubIdFromMember = member.club_id;

        // slug 조회
        const { data: club } = await supabase
          .from("clubs")
          .select("slug")
          .eq("id", member.club_id)
          .maybeSingle();
        clubSlug = club?.slug ?? null;
      }
    }
  } catch (e) {
    memberQueryError = String(e);
  }

  // 4. 실제 getAdminAccessServer() 결과
  const access = await getAdminAccessServer();
  const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"];

  // 5. 판정 reason
  let reason = "unknown";
  if (!hasUser) reason = "no_supabase_user";
  else if (!matchedMember) reason = "member_not_found_for_club";
  else if (!isActive) reason = "member_not_active";
  else if (!permissionRole || !KAKAO_ADMIN_ROLES.includes(permissionRole)) reason = "role_not_in_admin_list";
  else reason = "should_be_admin";

  return NextResponse.json({
    // 판정 요약
    isAdmin: access.isAdmin,
    isOwner: access.isOwner,
    reason,

    // 세부 진단
    hasUser,
    userIdPrefix,
    userError,
    cookieRole,
    currentClubId: currentClubId.slice(0, 8) + "…",

    // 멤버 조회 결과
    matchedMember,
    permissionRole,
    isActive,
    clubSlug,
    allowedRoles: KAKAO_ADMIN_ROLES,
    memberQueryError,

    // getAdminAccessServer 결과 요약
    accessSource: access.source,
    accessClubId: access.clubId ? access.clubId.slice(0, 8) + "…" : null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
