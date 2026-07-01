import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { PermissionRole } from "@/lib/supabase/database.types";

/**
 * kakao-admin-auth.ts — 카카오 로그인 사용자의 관리자 권한 확인.
 *
 * 기존 admin-auth.ts (cw_admin_session 쿠키 기반)와 독립적으로 동작.
 * 두 시스템은 OR 관계: 어느 쪽이든 인증되면 관리자로 인정.
 *
 * 권한 기준:
 *   관리자 (isKakaoAdmin = true):
 *     permission_role = "manager" | "admin" | "master"
 *   일반 회원:
 *     permission_role = "member" | "scorer"
 *
 * 서버 컴포넌트용: isKakaoAdminServer()
 * 클라이언트 컴포넌트용: isKakaoAdminClient()
 */

export const KAKAO_ADMIN_ROLES: PermissionRole[] = ["manager", "admin", "master"];
export const KAKAO_MASTER_ROLE: PermissionRole = "master";

function isAdminRole(role: PermissionRole | null | undefined): boolean {
  if (!role) return false;
  return (KAKAO_ADMIN_ROLES as string[]).includes(role);
}

function isMasterRole(role: PermissionRole | null | undefined): boolean {
  return role === KAKAO_MASTER_ROLE;
}

/** 서버 컴포넌트/Route Handler 전용 */
export async function isKakaoAdminServer(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: member } = await supabase
      .from("members")
      .select("permission_role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    return isAdminRole(member?.permission_role);
  } catch {
    return false;
  }
}

/** 카카오 master 여부 확인 (서버 컴포넌트용) */
export async function isKakaoMasterServer(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: member } = await supabase
      .from("members")
      .select("permission_role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    return isMasterRole(member?.permission_role);
  } catch {
    return false;
  }
}

/** 클라이언트 컴포넌트 전용 */
export async function isKakaoAdminClient(): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: member } = await supabase
      .from("members")
      .select("permission_role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    return isAdminRole(member?.permission_role);
  } catch {
    return false;
  }
}

/** 현재 카카오 로그인 사용자의 permission_role 반환 (클라이언트용) */
export async function getKakaoPermissionRole(): Promise<PermissionRole | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: member } = await supabase
      .from("members")
      .select("permission_role")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    return member?.permission_role ?? null;
  } catch {
    return null;
  }
}
