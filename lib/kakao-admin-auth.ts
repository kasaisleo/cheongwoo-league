import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { PermissionRole } from "@/lib/supabase/database.types";

/**
 * @deprecated — 이 파일의 모든 함수는 현재 import가 없습니다.
 *
 * 사용하지 말 것:
 *   - club_id 필터 없음 → 여러 클럽에 가입된 사용자일 때 잘못된 클럽의 role을 반환할 수 있음.
 *   - getSession() 사용 (서버에서 재검증하지 않는 캐시 세션) → getUser() 대신 사용해야 함.
 *
 * 대체 함수:
 *   - 서버 컴포넌트/Route Handler: lib/admin-permissions.ts → getAdminAccessServer()
 *   - 클라이언트: lib/hooks/useAdminAccess.ts → useAdminAccess()
 *
 * kakao-admin-auth.ts — 카카오 로그인 사용자의 관리자 권한 확인 (레거시).
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
