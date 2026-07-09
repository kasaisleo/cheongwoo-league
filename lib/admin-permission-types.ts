/**
 * lib/admin-permission-types.ts — 권한 관련 공통 타입/상수.
 *
 * 서버(lib/admin-permissions.ts)와 클라이언트(lib/hooks/useAdminAccess.ts)
 * 양쪽에서 import 가능. next/headers나 supabase/server를 절대 import하지 않는다.
 */

export type AdminSource  = "owner-cookie" | "kakao" | "none";
export type CookieRole   = "owner" | "manager" | null;

export interface AdminClubEntry {
  id:   string;
  slug: string;
  name: string;
  role: string;
}

export interface AdminAccess {
  isAdmin:       boolean;
  isOwner:       boolean;
  kakaoIsAdmin?: boolean;  // kakaoRole 단독 기준 admin 판정
  kakaoIsOwner?: boolean;  // kakaoRole 단독 기준 owner 판정
  source:     AdminSource;
  cookieRole: CookieRole;
  kakaoRole:  string | null;
  userId:     string | null;
  memberId:   string | null;
  clubId:     string | null;   // 관리 대상 클럽 ID
  clubSlug:   string | null;   // 관리 대상 클럽 slug (admin_club_slug 쿠키 기준)
  adminClubs: AdminClubEntry[]; // 멀티클럽: 이 user가 운영진인 클럽 목록 (선택 UI용)
}

export const COOKIE_ADMIN_ROLES  = ["owner", "manager"]             as const;
export const KAKAO_ADMIN_ROLES   = ["manager", "admin", "master"]   as const;
export const KAKAO_OWNER_ROLE    = "master"                         as const;

export const EMPTY_ACCESS: AdminAccess = {
  isAdmin: false, isOwner: false, kakaoIsAdmin: false, kakaoIsOwner: false, source: "none",
  cookieRole: null, kakaoRole: null, userId: null, memberId: null,
  clubId: null, clubSlug: null, adminClubs: [],
};
