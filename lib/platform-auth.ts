/**
 * lib/platform-auth.ts — CENTER COURT 플랫폼 어드민 권한 helper. 서버 전용.
 *
 * ⚠️ 이 파일은 서버 전용이다 (next/headers, next/navigation 사용).
 *    "use client" 파일에서 절대 import하지 말 것.
 *
 * 인증 구조:
 *   - Supabase auth.users / 카카오 로그인과 완전히 무관하다.
 *   - cw_admin_session (클럽 어드민 쿠키)과 완전히 무관하다.
 *   - 쿠키명: platform_admin_session (httpOnly, sameSite=lax, path=/center-court)
 *   - 쿠키에는 raw token(평문)만, DB에는 SHA-256(token)만 저장한다.
 *   - platform_admin_sessions.token_hash 로 세션을 조회한다.
 *   - platform_admins.status = 'active' 인 계정만 인증한다.
 *
 * 클럽 어드민 권한(lib/admin-permissions.ts)과 완전히 분리된 별도 레이어.
 *   - 클럽 어드민: members.permission_role 기반, 특정 club_id에 종속
 *   - 플랫폼 어드민: platform_admins 테이블 기반, club_id 완전 무관
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const PLATFORM_SESSION_COOKIE = "platform_admin_session";
export const PLATFORM_SESSION_MAX_AGE = 8 * 60 * 60; // 8시간 (초)

export type PlatformRole = "owner" | "admin" | "analyst";

export type PlatformAdminReason =
  | "authenticated"
  | "not_platform_admin"
  | "no_session";

export interface PlatformAccess {
  isPlatformAdmin: boolean;
  isPlatformOwner: boolean;
  role: PlatformRole | null;
  /** platform_admins.id (auth.users.id와 무관) */
  adminId: string | null;
  username: string | null;
  displayName: string | null;
  reason: PlatformAdminReason;
}

const EMPTY_PLATFORM_ACCESS: PlatformAccess = {
  isPlatformAdmin: false,
  isPlatformOwner: false,
  role: null,
  adminId: null,
  username: null,
  displayName: null,
  reason: "no_session",
};

/** raw token → SHA-256 hex */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * getPlatformAdminAccessServer() — 서버 컴포넌트 / Route Handler 전용.
 *
 * platform_admin_session 쿠키를 읽어 DB에서 세션을 검증한다.
 * Supabase auth.getUser()를 호출하지 않는다.
 * 절대 throw하지 않는다 — 모든 에러는 EMPTY_PLATFORM_ACCESS로 폴백한다.
 */
export async function getPlatformAdminAccessServer(): Promise<PlatformAccess> {
  try {
    const token = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
    if (!token) return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };

    const tokenHash = hashToken(token);
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from("platform_admin_sessions")
      .select(
        "admin_id, expires_at, revoked_at, platform_admins(role, status, username, display_name)"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!session) return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
    if (session.revoked_at) return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
    if (new Date(session.expires_at) <= new Date()) {
      return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
    }

    const admin = session.platform_admins as unknown as {
      role: string;
      status: string;
      username: string;
      display_name: string | null;
    } | null;

    if (!admin || admin.status !== "active") {
      return { ...EMPTY_PLATFORM_ACCESS, adminId: session.admin_id, reason: "not_platform_admin" };
    }

    const role = admin.role as PlatformRole;

    return {
      isPlatformAdmin: true,
      isPlatformOwner: role === "owner",
      role,
      adminId: session.admin_id,
      username: admin.username,
      displayName: admin.display_name,
      reason: "authenticated",
    };
  } catch {
    return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
  }
}

/**
 * requirePlatformAdminAccess() — analyst 이상이 아니면 redirect.
 *
 * app/center-court/(protected)/layout.tsx에서 호출한다.
 * 세션 없음 → /center-court/login
 * 로그인됐지만 플랫폼 어드민 아님 → /center-court/unauthorized
 */
export async function requirePlatformAdminAccess(): Promise<PlatformAccess> {
  const access = await getPlatformAdminAccessServer();

  if (access.reason === "no_session") {
    redirect("/center-court/login");
  }

  if (!access.isPlatformAdmin) {
    redirect("/center-court/unauthorized");
  }

  return access;
}

/**
 * requirePlatformOwnerAccess() — owner만 통과.
 *
 * /center-court/settings 등 플랫폼 설정 영역에서 호출한다.
 * analyst/admin → /center-court?reason=owner_required
 */
export async function requirePlatformOwnerAccess(): Promise<PlatformAccess> {
  const access = await getPlatformAdminAccessServer();

  if (access.reason === "no_session") {
    redirect("/center-court/login");
  }

  if (!access.isPlatformAdmin) {
    redirect("/center-court/unauthorized");
  }

  if (!access.isPlatformOwner) {
    redirect("/center-court?reason=owner_required");
  }

  return access;
}
