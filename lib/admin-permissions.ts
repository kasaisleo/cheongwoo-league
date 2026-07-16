/**
 * lib/admin-permissions.ts — 서버 전용 관리자 권한 헬퍼.
 *
 * 서버 컴포넌트 / Route Handler 전용.
 * next/headers, supabase/server 사용 → 클라이언트에서 import 금지.
 *
 * 인증 source: Supabase Kakao OAuth + members.permission_role (단일).
 * cw_admin_session 비밀번호 쿠키 제거.
 *
 * ## admin context 정책
 *
 * 1. /api/admin/enter?club=slug 가 admin_club_slug 쿠키를 설정한다.
 * 2. getAdminAccessServer() 는 이 쿠키를 source of truth 로 사용한다.
 * 3. admin_club_slug 쿠키가 있으면: 해당 club에서 admin 권한이 있는지만 검사.
 *    권한 없으면 isAdmin=false — 절대 다른 클럽으로 fallback하지 않는다.
 * 4. admin_club_slug 쿠키가 없으면: auth_user_id 기준으로 모든 운영진 멤버를 조회.
 *    - 0개: isAdmin=false
 *    - 1개+: adminClubs에 목록 반환, isAdmin=false → /admin에서 클럽 선택 UI 표시
 */

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import {
  KAKAO_ADMIN_ROLES,
  KAKAO_OWNER_ROLE,
  EMPTY_ACCESS,
  type AdminAccess,
} from "@/lib/admin-permission-types";

export type { AdminAccess, AdminSource } from "@/lib/admin-permission-types";

/**
 * getAdminAccessServer() — 서버 컴포넌트 / Route Handler 전용.
 *
 * admin_club_slug 쿠키를 읽어 club context를 결정한다.
 * Kakao permission_role 기반 권한 반환.
 */
export async function getAdminAccessServer(): Promise<AdminAccess> {
  let kakaoRole: string | null = null;
  let userId:    string | null = null;
  let memberId:  string | null = null;
  let clubId:    string | null = null;
  let clubSlug:  string | null = null;
  let adminClubs: AdminAccess["adminClubs"] = [];

  try {
    const supabase = createClient();
    const cookieStore = cookies();
    const adminSlug = cookieStore.get(ADMIN_CLUB_SLUG_COOKIE)?.value ?? null;

    // admin_club_slug 쿠키가 있으면 해당 club을 resolve
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
    }

    // 카카오 세션 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;

      if (adminSlug) {
        // admin_club_slug 있음 → 해당 club에서만 권한 검사, fallback 없음
        if (clubId) {
          // members_select_all 정책 삭제 이후에도 이 조회가 끊기지 않도록
          // service-role로 조회한다 — auth_user_id/club_id는 서버에서 도출한
          // 값만 쓰고, 클라이언트가 넘긴 club_id는 애초에 없다.
          const supabaseAdmin = createServiceClient();
          const { data: member } = await supabaseAdmin
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
        }
      } else {
        // admin_club_slug 없음 → 이 user가 운영진인 모든 클럽 조회
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
        }
      }
    }
  } catch { /* 세션 없음 */ }

  const kakaoIsAdmin = kakaoRole !== null && (KAKAO_ADMIN_ROLES as readonly string[]).includes(kakaoRole);
  const kakaoIsOwner = kakaoRole === KAKAO_OWNER_ROLE;

  return {
    isAdmin: kakaoIsAdmin,
    isOwner: kakaoIsOwner,
    kakaoIsAdmin,
    kakaoIsOwner,
    source: kakaoIsAdmin ? "kakao" : "none",
    kakaoRole,
    userId,
    memberId,
    clubId,
    clubSlug,
    adminClubs,
  };
}

/** 비관리자를 /admin으로 redirect. */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) redirect("/admin?reason=admin_required");
  return access;
}

/** 비 Owner를 /admin으로 redirect. */
export async function requireOwnerAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isOwner) redirect("/admin?reason=owner_required");
  return access;
}
