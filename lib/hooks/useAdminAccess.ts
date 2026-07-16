"use client";

import { useEffect, useState } from "react";
import {
  KAKAO_ADMIN_ROLES,
  KAKAO_OWNER_ROLE,
  EMPTY_ACCESS,
  type AdminAccess,
} from "@/lib/admin-permission-types";

/**
 * useAdminAccess() — 클라이언트 컴포넌트 전용 통합 관리자 권한 훅.
 *
 * members_select_all 정책 삭제 이후에도 동작해야 하므로, members 조회는
 * 브라우저에서 직접 하지 않고 서버 Route Handler(/api/auth/status,
 * service-role)에 위임한다. 세션(userId)만 클라이언트에서 auth.getSession()으로
 * 확인한다 — 이건 members 테이블 조회가 아니라 RLS와 무관하다.
 *
 * 반환:
 *   null       = 로딩 중
 *   AdminAccess = 판단 완료 (isAdmin, isOwner 등)
 */
export function useAdminAccess(currentClubId: string): AdminAccess | null {
  const [access, setAccess] = useState<AdminAccess | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let userId: string | null = null;

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) userId = session.user.id;
      } catch { /* 무시 */ }

      let kakaoRole: string | null = null;
      let memberId: string | null = null;

      if (userId) {
        try {
          const res = await fetch("/api/auth/status");
          const body = await res.json();
          if (body?.permissionRole) {
            kakaoRole = body.permissionRole as string;
            memberId = body.memberId ?? null;
          }
        } catch { /* 무시 */ }
      }

      const kakaoIsAdmin = kakaoRole !== null &&
        (KAKAO_ADMIN_ROLES as readonly string[]).includes(kakaoRole);
      const kakaoIsOwner = kakaoRole === KAKAO_OWNER_ROLE;

      if (!cancelled) {
        setAccess({
          isAdmin: kakaoIsAdmin,
          isOwner: kakaoIsOwner,
          kakaoIsAdmin,
          kakaoIsOwner,
          source: kakaoIsAdmin ? "kakao" : "none",
          kakaoRole,
          userId,
          memberId,
          clubId: null,
          clubSlug: null,
          adminClubs: [],
        });
      }
    }

    check();
    return () => { cancelled = true; };
  }, [currentClubId]);

  return access;
}
