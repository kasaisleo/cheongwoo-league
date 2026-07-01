/**
 * lib/admin-permission-types.ts — 권한 관련 공통 타입/상수.
 *
 * 서버(lib/admin-permissions.ts)와 클라이언트(lib/hooks/useAdminAccess.ts)
 * 양쪽에서 import 가능. next/headers나 supabase/server를 절대 import하지 않는다.
 */

export type AdminSource  = "owner-cookie" | "kakao" | "none";
export type CookieRole   = "owner" | "manager" | null;

export interface AdminAccess {
  isAdmin:    boolean;
  isOwner:    boolean;
  source:     AdminSource;
  cookieRole: CookieRole;
  kakaoRole:  string | null;   // PermissionRole 값 ("member"|"scorer"|"manager"|"admin"|"master")
  userId:     string | null;
  memberId:   string | null;
}

export const COOKIE_ADMIN_ROLES  = ["owner", "manager"]             as const;
export const KAKAO_ADMIN_ROLES   = ["manager", "admin", "master"]   as const;
export const KAKAO_OWNER_ROLE    = "master"                         as const;

export const EMPTY_ACCESS: AdminAccess = {
  isAdmin: false, isOwner: false, source: "none",
  cookieRole: null, kakaoRole: null, userId: null, memberId: null,
};
