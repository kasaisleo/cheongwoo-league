/**
 * lib/admin-permissions.ts — 서버 전용 관리자 권한 헬퍼.
 *
 * 서버 컴포넌트 / Route Handler 전용.
 * next/headers, supabase/server 사용 → 클라이언트에서 import 금지.
 *
 * 클라이언트에서는 lib/hooks/useAdminAccess.ts 를 사용한다.
 * 공통 타입/상수는 lib/admin-permission-types.ts 에서 가져온다.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { getCurrentClubId } from "@/lib/current-club";
import {
  COOKIE_ADMIN_ROLES,
  KAKAO_ADMIN_ROLES,
  KAKAO_OWNER_ROLE,
  EMPTY_ACCESS,
  type AdminAccess,
  type CookieRole,
} from "@/lib/admin-permission-types";

export type { AdminAccess, AdminSource, CookieRole } from "@/lib/admin-permission-types";

/**
 * getAdminAccessServer() — 서버 컴포넌트 / Route Handler 전용.
 * cw_admin_session 쿠키 + 카카오 permission_role 통합 권한 반환.
 */
export async function getAdminAccessServer(): Promise<AdminAccess> {
  // 1. cw_admin_session 쿠키 확인
  let cookieRole: CookieRole = null;
  try {
    const raw = getAdminRole();
    if (raw === "owner" || raw === "manager") cookieRole = raw;
  } catch { /* 쿠키 없음 */ }

  // 2. 카카오 세션 + permission_role 확인
  //    getSession()은 미들웨어 updateSession 없이 만료될 수 있음.
  //    getUser()는 JWT를 서버에서 직접 검증 → 더 신뢰할 수 있음.
  let kakaoRole: string | null = null;
  let userId: string | null = null;
  let memberId: string | null = null;

  try {
    const supabase = createClient();
    const currentClubId = await getCurrentClubId();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: member } = await supabase
        .from("members")
        .select("id, permission_role")
        .eq("auth_user_id", user.id)
        .eq("club_id", currentClubId)
        .maybeSingle();
      if (member) {
        kakaoRole = member.permission_role;
        memberId  = member.id;
      }
    }
  } catch { /* 세션 없음 */ }

  // 3. 권한 계산
  const cookieIsAdmin = cookieRole !== null && (COOKIE_ADMIN_ROLES as readonly string[]).includes(cookieRole);
  const cookieIsOwner = cookieRole === "owner";
  const kakaoIsAdmin  = kakaoRole  !== null && (KAKAO_ADMIN_ROLES  as readonly string[]).includes(kakaoRole);
  const kakaoIsOwner  = kakaoRole  === KAKAO_OWNER_ROLE;

  const isAdmin = cookieIsAdmin || kakaoIsAdmin;
  const isOwner = cookieIsOwner || kakaoIsOwner;

  const source = cookieIsAdmin ? "owner-cookie" : kakaoIsAdmin ? "kakao" : "none";

  return { isAdmin, isOwner, source, cookieRole, kakaoRole, userId, memberId };
}

/**
 * requireAdminAccess() — 비관리자를 /admin 으로 redirect.
 */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) redirect("/admin");
  return access;
}

/**
 * requireOwnerAccess() — 비 Owner를 /admin 으로 redirect.
 */
export async function requireOwnerAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isOwner) redirect("/admin");
  return access;
}
