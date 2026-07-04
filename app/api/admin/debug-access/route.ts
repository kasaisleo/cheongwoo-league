import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-auth";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * GET /api/admin/debug-access
 *
 * 서버 기준 권한 상태 진단용 임시 API.
 * 카카오 master 로그인 상태에서 서버가 어떤 값을 읽는지 확인한다.
 *
 * 배포 안정화 후 제거 또는 owner 전용으로 제한할 것.
 *
 * 확인 항목:
 *   1. getSession() vs getUser() 결과 차이
 *   2. user.id로 members 조회 결과
 *   3. permission_role 서버 읽기 여부
 *   4. getAdminRole() (cw_admin_session 쿠키) 결과
 */
export async function GET() {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();

  // 1. cw_admin_session 쿠키 기반 role
  let cookieRole: string | null = null;
  try {
    cookieRole = getAdminRole();
  } catch {
    cookieRole = null;
  }

  // 2. getSession() — 쿠키에서 세션 읽기 (미들웨어 updateSession 없으면 만료될 수 있음)
  let sessionUserId: string | null = null;
  let sessionError: string | null = null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    sessionUserId = session?.user?.id ?? null;
    sessionError = error?.message ?? null;
  } catch (e) {
    sessionError = String(e);
  }

  // 3. getUser() — JWT 직접 검증 (더 신뢰할 수 있음)
  let userUserId: string | null = null;
  let userError: string | null = null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    userUserId = user?.id ?? null;
    userError = error?.message ?? null;
  } catch (e) {
    userError = String(e);
  }

  // 4. user.id로 members 조회 (getUser 기반)
  let memberId: string | null = null;
  let kakaoRole: string | null = null;
  let memberError: string | null = null;
  let memberQueryUsed: string | null = null;

  const queryUserId = userUserId ?? sessionUserId;
  if (queryUserId) {
    memberQueryUsed = queryUserId;
    try {
      const { data: member, error } = await supabase
        .from("members")
        .select("id, permission_role, name, auth_user_id")
        .eq("auth_user_id", queryUserId)
        .eq("club_id", currentClubId)
        .maybeSingle();
      memberId  = member?.id ?? null;
      kakaoRole = member?.permission_role ?? null;
      memberError = error?.message ?? null;
    } catch (e) {
      memberError = String(e);
    }
  }

  // 5. 권한 계산 (admin-permissions.ts 로직과 동일)
  const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"];
  const cookieIsAdmin = cookieRole === "owner" || cookieRole === "manager";
  const kakaoIsAdmin  = kakaoRole !== null && KAKAO_ADMIN_ROLES.includes(kakaoRole);
  const isAdmin = cookieIsAdmin || kakaoIsAdmin;
  const isOwner = cookieRole === "owner" || kakaoRole === "master";

  return NextResponse.json({
    // 진단 핵심
    isAdmin,
    isOwner,
    kakaoRole,
    cookieRole,

    // 상세 디버그
    getSession: {
      userId: sessionUserId,
      error: sessionError,
    },
    getUser: {
      userId: userUserId,
      error: userError,
    },
    memberQuery: {
      usedUserId: memberQueryUsed,
      memberId,
      kakaoRole,
      error: memberError,
    },

    // 진단 요약
    diagnosis: {
      sessionVsUserMatch: sessionUserId === userUserId,
      sessionWorking: sessionUserId !== null,
      userWorking: userUserId !== null,
      memberFound: memberId !== null,
      roleReadCorrectly: kakaoRole !== null,
    },
  }, {
    headers: {
      // 캐시 방지
      "Cache-Control": "no-store",
    },
  });
}
