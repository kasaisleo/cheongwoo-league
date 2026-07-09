/**
 * lib/admin-permissions.ts — 서버 전용 관리자 권한 헬퍼.
 *
 * 서버 컴포넌트 / Route Handler 전용.
 * next/headers, supabase/server 사용 → 클라이언트에서 import 금지.
 *
 * 클라이언트에서는 lib/hooks/useAdminAccess.ts 를 사용한다.
 * 공통 타입/상수는 lib/admin-permission-types.ts 에서 가져온다.
 *
 * ## admin context 정책
 *
 * 1. /api/admin/enter?club=slug 가 admin_club_slug 쿠키를 설정한다.
 * 2. getAdminAccessServer() 는 이 쿠키를 source of truth 로 사용한다.
 * 3. admin_club_slug 쿠키가 있으면: 해당 club에서 admin 권한이 있는지만 검사.
 *    권한 없으면 isAdmin=false — 절대 다른 클럽으로 fallback하지 않는다.
 * 4. admin_club_slug 쿠키가 없으면: auth_user_id 기준으로 모든 운영진 멤버를 조회.
 *    - 0개: isAdmin=false
 *    - 1개: 그 클럽을 자동 선택
 *    - 2개+: adminClubs 에 목록 반환, isAdmin=false → /admin 에서 클럽 선택 UI 표시
 */

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAdminRole, ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
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
 *
 * admin_club_slug 쿠키를 읽어 club context를 결정한다.
 * cw_admin_session + 카카오 permission_role 통합 권한 반환.
 */
export async function getAdminAccessServer(): Promise<AdminAccess> {
  // 1. cw_admin_session 쿠키 확인
  let cookieRole: CookieRole = null;
  try {
    const raw = getAdminRole();
    if (raw === "owner" || raw === "manager") cookieRole = raw;
  } catch { /* 쿠키 없음 */ }

  let kakaoRole: string | null = null;
  let userId: string | null = null;
  let memberId: string | null = null;
  let clubId: string | null = null;
  let clubSlug: string | null = null;
  let adminClubs: AdminAccess["adminClubs"] = [];

  try {
    const supabase = createClient();
    const cookieStore = cookies();
    const adminSlug = cookieStore.get(ADMIN_CLUB_SLUG_COOKIE)?.value ?? null;

    // admin_club_slug 쿠키가 있으면 해당 club을 우선 resolve (kakao+cookie 공통)
    if (adminSlug) {
      const { data: club } = await supabase
        .from("clubs")
        .select("id, slug")
        .eq("slug", adminSlug)
        .eq("status", "active")
        .maybeSingle();
      if (club) {
        clubId   = club.id;
        clubSlug = club.slug;
      }
      // club이 없으면 clubId/clubSlug null 유지 → 이후 kakao 조회도 skip
    }

    // 2. 카카오 세션 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;

      if (adminSlug) {
        // admin_club_slug 있음 → 해당 club 에서만 권한 검사, 절대 fallback 없음
        if (clubId) {
          const { data: member } = await supabase
            .from("members")
            .select("id, permission_role, club_id")
            .eq("auth_user_id", user.id)
            .eq("club_id", clubId)
            .eq("is_active", true)
            .maybeSingle();

          if (member && (KAKAO_ADMIN_ROLES as readonly string[]).includes(member.permission_role)) {
            kakaoRole = member.permission_role;
            memberId  = member.id;
          }
          // 권한 없으면 kakaoRole null → isAdmin false (다른 클럽으로 fallback 금지)
        }
      } else {
        // admin_club_slug 없음 → 이 user가 운영진인 모든 클럽 조회.
        // members RLS는 club_id 없이 전체 조회를 차단할 수 있으므로
        // auth.getUser()로 신원 확인 후 service client로 조회한다.
        const supabaseAdmin = createServiceClient();
        const { data: adminMembers } = await supabaseAdmin
          .from("members")
          .select("id, permission_role, club_id")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .in("permission_role", KAKAO_ADMIN_ROLES);

        if (adminMembers && adminMembers.length > 0) {
          const clubIds = adminMembers.map((m) => m.club_id).filter(Boolean) as string[];

          const { data: activeClubs } = await supabase
            .from("clubs")
            .select("id, slug, name")
            .in("id", clubIds)
            .eq("status", "active");

          const clubMap = new Map((activeClubs ?? []).map((c) => [c.id, c]));

          adminClubs = adminMembers
            .filter((m) => clubMap.has(m.club_id))
            .map((m) => {
              const c = clubMap.get(m.club_id)!;
              return { id: m.club_id, slug: c.slug, name: c.name, role: m.permission_role };
            });

          // 단일/복수 모두: 자동 선택하지 않는다.
          // 페이지가 adminClubs를 보고 단일이면 /api/admin/enter?club= 으로 redirect,
          // 복수이면 클럽 선택 UI를 표시한다.
          // 자동 선택을 하면 기존 admin_club_slug 쿠키 삭제 후에도 단일 클럽이
          // 자동으로 재선택돼 다른 클럽 권한 실패 후 청우회 데이터가 보이는 보안 문제 발생.
        }
      }
    }

    // cookie admin이더라도 admin_club_slug 없이는 clubId를 결정하지 않는다.
    // 대시보드 렌더는 admin/page.tsx에서 access.clubId 유무로 게이팅한다.
  } catch { /* 세션 없음 */ }

  // 3. 권한 계산
  const cookieIsAdmin = cookieRole !== null && (COOKIE_ADMIN_ROLES as readonly string[]).includes(cookieRole);
  const cookieIsOwner = cookieRole === "owner";
  const kakaoIsAdmin  = kakaoRole  !== null && (KAKAO_ADMIN_ROLES  as readonly string[]).includes(kakaoRole);
  const kakaoIsOwner  = kakaoRole  === KAKAO_OWNER_ROLE;

  const isAdmin = cookieIsAdmin || kakaoIsAdmin;
  const isOwner = cookieIsOwner || kakaoIsOwner;

  const source = cookieIsAdmin ? "owner-cookie" : kakaoIsAdmin ? "kakao" : "none";

  return {
    isAdmin, isOwner, kakaoIsAdmin, kakaoIsOwner,
    source, cookieRole, kakaoRole,
    userId, memberId, clubId, clubSlug, adminClubs,
  };
}

/**
 * requireAdminAccess() — 비관리자를 /admin 으로 redirect.
 */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) redirect("/admin?reason=admin_required");
  return access;
}

/**
 * requireOwnerAccess() — 비 Owner를 /admin 으로 redirect.
 */
export async function requireOwnerAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isOwner) redirect("/admin?reason=owner_required");
  return access;
}
