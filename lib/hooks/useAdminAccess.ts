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
 * lib/admin-permissions.ts (서버 전용) 를 import하지 않는다.
 * Supabase client + members 테이블 조회로 Kakao permission_role을 확인한다.
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
      let kakaoRole: string | null = null;
      let userId:    string | null = null;
      let memberId:  string | null = null;

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          userId = session.user.id;
          const { data: member } = await supabase
            .from("members")
            .select("id, permission_role")
            .eq("auth_user_id", session.user.id)
            .eq("club_id", currentClubId)
            .maybeSingle();
          if (member) {
            kakaoRole = member.permission_role as string;
            memberId  = member.id;
          }
        }
      } catch { /* 무시 */ }

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
