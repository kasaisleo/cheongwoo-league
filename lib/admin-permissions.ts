/**
 * lib/admin-permissions.ts — 관리자 권한 통합 헬퍼.
 *
 * 모든 관리자 페이지의 권한 판단은 이 파일의 함수로만 처리한다.
 * 개별 페이지에서 getAdminRole(), isKakaoAdminServer() 등을 직접 조합하지 않는다.
 *
 * 권한 기준:
 *   isAdmin  = cookieRole ∈ ["owner","manager"]  OR  kakaoRole ∈ ["manager","admin","master"]
 *   isOwner  = cookieRole === "owner"             OR  kakaoRole === "master"
 *
 * 보호 파일(lib/admin-auth.ts, middleware.ts, app/api/auth/logout/route.ts) 수정 없음.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import type { PermissionRole } from "@/lib/supabase/database.types";

// ── 상수 ─────────────────────────────────────────────────────────────────────

const COOKIE_ADMIN_ROLES  = ["owner", "manager"] as const;
const KAKAO_ADMIN_ROLES   = ["manager", "admin", "master"] as const;
const KAKAO_OWNER_ROLE    = "master" as const;

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type AdminSource = "owner-cookie" | "kakao" | "none";
export type CookieRole  = "owner" | "manager" | null;

export interface AdminAccess {
  isAdmin:    boolean;
  isOwner:    boolean;
  source:     AdminSource;
  cookieRole: CookieRole;
  kakaoRole:  PermissionRole | null;
  userId:     string | null;   // auth.users.id
  memberId:   string | null;   // members.id
}

// ── 서버 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * getAdminAccessServer() — 서버 컴포넌트 / Route Handler 전용.
 *
 * cw_admin_session 쿠키와 카카오 세션을 모두 확인해 통합 권한 객체를 반환한다.
 * 에러가 나도 안전하게 {isAdmin:false, isOwner:false, ...} 를 반환한다.
 */
export async function getAdminAccessServer(): Promise<AdminAccess> {
  const base: AdminAccess = {
    isAdmin: false, isOwner: false, source: "none",
    cookieRole: null, kakaoRole: null, userId: null, memberId: null,
  };

  // 1. cw_admin_session 쿠키 확인
  let cookieRole: CookieRole = null;
  try {
    const raw = getAdminRole();
    if (raw === "owner" || raw === "manager") cookieRole = raw;
  } catch { /* 쿠키 없음 — 무시 */ }

  // 2. 카카오 세션 + permission_role 확인
  let kakaoRole: PermissionRole | null = null;
  let userId: string | null = null;
  let memberId: string | null = null;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      userId = session.user.id;
      const { data: member } = await supabase
        .from("members")
        .select("id, permission_role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (member) {
        kakaoRole  = member.permission_role;
        memberId   = member.id;
      }
    }
  } catch { /* 세션 없음 — 무시 */ }

  // 3. 권한 계산
  const cookieIsAdmin  = cookieRole !== null && (COOKIE_ADMIN_ROLES as readonly string[]).includes(cookieRole);
  const cookieIsOwner  = cookieRole === "owner";
  const kakaoIsAdmin   = kakaoRole  !== null && (KAKAO_ADMIN_ROLES  as readonly string[]).includes(kakaoRole);
  const kakaoIsOwner   = kakaoRole  === KAKAO_OWNER_ROLE;

  const isAdmin  = cookieIsAdmin || kakaoIsAdmin;
  const isOwner  = cookieIsOwner || kakaoIsOwner;

  let source: AdminSource = "none";
  if (cookieIsAdmin)       source = "owner-cookie";
  else if (kakaoIsAdmin)   source = "kakao";

  return { isAdmin, isOwner, source, cookieRole, kakaoRole, userId, memberId };
}

/**
 * requireAdminAccess() — 관리자 전용 서버 컴포넌트에서 사용.
 * isAdmin이 아니면 /admin 으로 redirect (Next.js redirect()).
 */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) redirect("/admin");
  return access;
}

/**
 * requireOwnerAccess() — Owner 전용 서버 컴포넌트에서 사용.
 * isOwner가 아니면 /admin 으로 redirect.
 */
export async function requireOwnerAccess(): Promise<AdminAccess> {
  const access = await getAdminAccessServer();
  if (!access.isOwner) redirect("/admin");
  return access;
}

// ── 클라이언트 헬퍼 (훅 형태 아님 — 직접 fetch 방식) ────────────────────────

/**
 * getAdminAccessClient() — 클라이언트 컴포넌트에서 useEffect 내부에서 호출.
 * 서버 헬퍼와 동일한 로직을 클라이언트에서 재현한다.
 */
export async function getAdminAccessClient(): Promise<AdminAccess> {
  // 동적 import로 클라이언트 supabase만 가져옴
  const { createClient: createBrowserClient } = await import("@/lib/supabase/client");

  const base: AdminAccess = {
    isAdmin: false, isOwner: false, source: "none",
    cookieRole: null, kakaoRole: null, userId: null, memberId: null,
  };

  // 1. cw_admin_session → /api/auth/status 경유
  let cookieRole: CookieRole = null;
  try {
    const res  = await fetch("/api/auth/status");
    const body = await res.json();
    const raw  = body?.role;
    if (raw === "owner" || raw === "manager") cookieRole = raw;
  } catch { /* 무시 */ }

  // 2. 카카오 세션
  let kakaoRole: PermissionRole | null = null;
  let userId: string | null = null;
  let memberId: string | null = null;

  try {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      userId = session.user.id;
      const { data: member } = await supabase
        .from("members")
        .select("id, permission_role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (member) {
        kakaoRole = member.permission_role;
        memberId  = member.id;
      }
    }
  } catch { /* 무시 */ }

  const cookieIsAdmin = cookieRole !== null && (COOKIE_ADMIN_ROLES as readonly string[]).includes(cookieRole);
  const cookieIsOwner = cookieRole === "owner";
  const kakaoIsAdmin  = kakaoRole  !== null && (KAKAO_ADMIN_ROLES  as readonly string[]).includes(kakaoRole);
  const kakaoIsOwner  = kakaoRole  === KAKAO_OWNER_ROLE;

  const isAdmin = cookieIsAdmin || kakaoIsAdmin;
  const isOwner = cookieIsOwner || kakaoIsOwner;

  let source: AdminSource = "none";
  if (cookieIsAdmin)     source = "owner-cookie";
  else if (kakaoIsAdmin) source = "kakao";

  return { isAdmin, isOwner, source, cookieRole, kakaoRole, userId, memberId };
}
