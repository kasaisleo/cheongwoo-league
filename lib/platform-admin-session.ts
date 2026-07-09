/**
 * lib/platform-admin-session.ts — CENTER COURT 세션 검증 helper. 서버 전용.
 *
 * ⚠️ 서버 컴포넌트 / Route Handler 전용 (next/headers 사용).
 *    "use client" 파일에서 절대 import하지 말 것.
 *
 * - Supabase auth.users / 카카오 로그인과 완전 무관.
 * - cw_admin_session / selected_club_id / permission_role 과 완전 무관.
 * - 쿠키명: platform_admin_session (httpOnly, path="/")
 * - DB에는 SHA-256(token)만 저장. 쿠키에는 raw token만.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { hashPlatformSessionToken } from "@/lib/platform-password";

export const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export type PlatformRole = "owner" | "admin" | "analyst";

export interface PlatformAdminSession {
  adminId: string;
  username: string;
  displayName: string | null;
  role: PlatformRole;
}

/**
 * getPlatformAdminSession() — 세션 검증. 유효하면 admin 정보 반환, 아니면 null.
 * 절대 throw하지 않는다.
 */
export async function getPlatformAdminSession(): Promise<PlatformAdminSession | null> {
  try {
    const rawToken = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
    if (!rawToken) return null;

    const tokenHash = hashPlatformSessionToken(rawToken);
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from("platform_admin_sessions")
      .select(
        "admin_id, expires_at, revoked_at, platform_admins(id, username, display_name, role, status)"
      )
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!session) return null;

    const admin = session.platform_admins as unknown as {
      id: string;
      username: string;
      display_name: string | null;
      role: string;
      status: string;
    } | null;

    if (!admin || admin.status !== "active") return null;

    return {
      adminId: admin.id,
      username: admin.username,
      displayName: admin.display_name,
      role: admin.role as PlatformRole,
    };
  } catch {
    return null;
  }
}

/**
 * requirePlatformAdmin() — 인증 필수. 세션 없음/만료/폐기/비활성이면 /center-court/login redirect.
 * app/center-court/(protected)/layout.tsx 에서 호출.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminSession> {
  const session = await getPlatformAdminSession();
  if (!session) {
    redirect("/center-court/login");
  }
  return session;
}
