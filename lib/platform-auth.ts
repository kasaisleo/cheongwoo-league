/**
 * lib/platform-auth.ts — CENTER COURT 플랫폼 어드민 권한 helper. 서버 전용.
 *
 * ⚠️ 이 파일은 서버 전용이다 (createServiceClient, next/navigation 사용).
 *    "use client" 파일에서 절대 import하지 말 것.
 *
 * 클럽 어드민 권한(lib/admin-permissions.ts)과 완전히 분리된 별도 레이어.
 *   - 클럽 어드민: members.permission_role 기반, 특정 club_id에 종속
 *   - 플랫폼 어드민: platform_admins 테이블 기반, 어떤 club_id에도 종속되지 않음
 *
 * 조회는 service_role 클라이언트로만 수행한다 (platform_admins RLS = 비공개).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type PlatformRole = "owner" | "admin" | "analyst";

export type PlatformAdminReason =
  | "authenticated"
  | "not_platform_admin"
  | "no_session";

export interface PlatformAccess {
  isPlatformAdmin: boolean;
  isPlatformOwner: boolean;
  role: PlatformRole | null;
  /** auth.users.id */
  userId: string | null;
  reason: PlatformAdminReason;
}

const EMPTY_PLATFORM_ACCESS: PlatformAccess = {
  isPlatformAdmin: false,
  isPlatformOwner: false,
  role: null,
  userId: null,
  reason: "no_session",
};

/**
 * getPlatformAdminAccessServer() — 서버 컴포넌트 / Route Handler 전용.
 *
 * 카카오 세션(auth.users)을 확인한 후 platform_admins 테이블에서 role을 조회한다.
 * cw_admin_session 쿠키(클럽 어드민용)와 완전히 무관하다.
 * 절대 throw하지 않는다 — 모든 에러는 EMPTY_PLATFORM_ACCESS로 폴백한다.
 */
export async function getPlatformAdminAccessServer(): Promise<PlatformAccess> {
  try {
    const supabase = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
    }

    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!platformAdmin) {
      return {
        ...EMPTY_PLATFORM_ACCESS,
        userId: user.id,
        reason: "not_platform_admin",
      };
    }

    const role = platformAdmin.role as PlatformRole;

    return {
      isPlatformAdmin: true,
      isPlatformOwner: role === "owner",
      role,
      userId: user.id,
      reason: "authenticated",
    };
  } catch {
    return { ...EMPTY_PLATFORM_ACCESS, reason: "no_session" };
  }
}

/**
 * requirePlatformAdminAccess() — 플랫폼 어드민(owner/admin/analyst)이 아니면 redirect.
 *
 * /center-court 하위 레이아웃에서 호출한다.
 * analyst 이상이면 통과, 미인증이면 /login으로, 로그인됐지만 플랫폼 어드민이 아니면
 * /center-court/unauthorized로 redirect한다.
 */
export async function requirePlatformAdminAccess(): Promise<PlatformAccess> {
  const access = await getPlatformAdminAccessServer();

  if (access.reason === "no_session") {
    redirect("/login");
  }

  if (!access.isPlatformAdmin) {
    redirect("/center-court/unauthorized");
  }

  return access;
}

/**
 * requirePlatformOwnerAccess() — 플랫폼 owner만 통과.
 *
 * /center-court/settings 등 플랫폼 설정 영역에서 호출한다.
 * analyst/admin 역할은 403 redirect.
 */
export async function requirePlatformOwnerAccess(): Promise<PlatformAccess> {
  const access = await getPlatformAdminAccessServer();

  if (access.reason === "no_session") {
    redirect("/login");
  }

  if (!access.isPlatformAdmin) {
    redirect("/center-court/unauthorized");
  }

  if (!access.isPlatformOwner) {
    redirect("/center-court?reason=owner_required");
  }

  return access;
}
