/**
 * lib/admin-auth.ts — admin 쿠키 상수 및 타입.
 *
 * cw_admin_session(비밀번호 기반 쿠키 세션)은 제거됨.
 * 인증은 Supabase Kakao OAuth + members.permission_role로 단일화.
 *
 * 남은 것:
 *   ADMIN_CLUB_SLUG_COOKIE — 선택된 클럽 slug 저장 (권한 증명 아님)
 *   AdminRole              — 역할 타입 (useAdminRole 훅 호환용)
 */

/** 선택된 클럽 slug 쿠키. /api/admin/enter에서 설정, getAdminAccessServer()가 읽음. */
export const ADMIN_CLUB_SLUG_COOKIE = "admin_club_slug";

/**
 * Admin 역할 타입. DB permission_role에서 파생:
 *   "master" → "owner"
 *   "manager" | "admin" → "manager"
 */
export type AdminRole = "owner" | "manager";
