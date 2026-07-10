/**
 * lib/admin-permission-types.ts — 권한 관련 공통 타입/상수.
 *
 * 서버(lib/admin-permissions.ts)와 클라이언트(lib/hooks/useAdminAccess.ts)
 * 양쪽에서 import 가능. next/headers나 supabase/server를 절대 import하지 않는다.
 *
 * cw_admin_session(비밀번호 쿠키) 제거로 CookieRole, COOKIE_ADMIN_ROLES, "owner-cookie" source 삭제.
 * 인증 source는 "kakao" 단일화.
 */

export type AdminSource = "kakao" | "none";

export interface AdminClubEntry {
  id:   string;
  slug: string;
  name: string;
  role: string;
}

export interface AdminAccess {
  isAdmin:      boolean;
  isOwner:      boolean;
  kakaoIsAdmin: boolean;
  kakaoIsOwner: boolean;
  source:       AdminSource;
  kakaoRole:    string | null;
  userId:       string | null;
  memberId:     string | null;
  clubId:       string | null;
  clubSlug:     string | null;
  adminClubs:   AdminClubEntry[];
}

export const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"] as const;
export const KAKAO_OWNER_ROLE  = "master"                       as const;

export const EMPTY_ACCESS: AdminAccess = {
  isAdmin: false, isOwner: false, kakaoIsAdmin: false, kakaoIsOwner: false,
  source: "none", kakaoRole: null, userId: null, memberId: null,
  clubId: null, clubSlug: null, adminClubs: [],
};
