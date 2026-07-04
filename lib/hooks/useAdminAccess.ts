"use client";

import { useEffect, useState } from "react";
import {
  COOKIE_ADMIN_ROLES,
  KAKAO_ADMIN_ROLES,
  KAKAO_OWNER_ROLE,
  EMPTY_ACCESS,
  type AdminAccess,
  type CookieRole,
} from "@/lib/admin-permission-types";
import { DEFAULT_CLUB_ID } from "@/lib/club-constants";

/**
 * useAdminAccess() — 클라이언트 컴포넌트 전용 통합 관리자 권한 훅.
 *
 * lib/admin-permissions.ts (서버 전용) 를 import하지 않는다.
 * lib/supabase/server.ts, next/headers 도 import하지 않는다.
 * lib/admin-permission-types.ts (타입/상수만) 만 import한다.
 *
 * 권한 확인 방법:
 *   cw_admin_session → /api/auth/status API 경유 (httpOnly 쿠키 직접 접근 불가)
 *   카카오 permission_role → supabase/client + members 테이블 조회
 *
 * 반환:
 *   null       = 로딩 중
 *   AdminAccess = 판단 완료 (isAdmin, isOwner 등)
 */
export function useAdminAccess(): AdminAccess | null {
  const [access, setAccess] = useState<AdminAccess | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. cw_admin_session 확인 (httpOnly → /api/auth/status 경유)
      let cookieRole: CookieRole = null;
      try {
        const res  = await fetch("/api/auth/status");
        const body = await res.json() as { role?: string; isAdmin?: boolean };
        const raw  = body?.role;
        if (raw === "owner" || raw === "manager") cookieRole = raw;
      } catch { /* 무시 */ }

      // 2. 카카오 세션 + permission_role 확인
      //    supabase/client만 사용 — server.ts import 금지
      let kakaoRole: string | null = null;
      let userId: string | null    = null;
      let memberId: string | null  = null;

      try {
        // 동적 import → 빌드 시 서버/클라이언트 번들 분리 보장
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          userId = session.user.id;
          const { data: member } = await supabase
            .from("members")
            .select("id, permission_role")
            .eq("auth_user_id", session.user.id)
            .eq("club_id", DEFAULT_CLUB_ID)
            .maybeSingle();
          if (member) {
            kakaoRole = member.permission_role as string;
            memberId  = member.id;
          }
        }
      } catch { /* 무시 */ }

      // 3. 권한 계산
      const cookieIsAdmin = cookieRole !== null &&
        (COOKIE_ADMIN_ROLES as readonly string[]).includes(cookieRole);
      const cookieIsOwner = cookieRole === "owner";
      const kakaoIsAdmin  = kakaoRole  !== null &&
        (KAKAO_ADMIN_ROLES  as readonly string[]).includes(kakaoRole);
      const kakaoIsOwner  = kakaoRole  === KAKAO_OWNER_ROLE;

      const isAdmin  = cookieIsAdmin || kakaoIsAdmin;
      const isOwner  = cookieIsOwner || kakaoIsOwner;
      const source   = cookieIsAdmin ? "owner-cookie" : kakaoIsAdmin ? "kakao" : "none";

      if (!cancelled) {
        setAccess({ isAdmin, isOwner, source, cookieRole, kakaoRole, userId, memberId });
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return access;
}
