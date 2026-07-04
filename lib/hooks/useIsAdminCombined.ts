"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CLUB_ID } from "@/lib/current-club";

const KAKAO_ADMIN_ROLES = ["manager", "admin", "master"];

/**
 * useIsAdminCombined — cw_admin_session OR 카카오 permission_role 통합 체크.
 *
 * useAdminRole() / useIsAdmin()은 cw_admin_session 쿠키만 확인한다.
 * 카카오 로그인 기반 permission_role >= manager 사용자를 포함하려면
 * 이 훅을 사용한다.
 *
 * 반환값:
 *   null    — 아직 확인 중 (로딩)
 *   true    — 관리자 (쿠키 세션 OR 카카오 permission_role >= manager)
 *   false   — 비관리자 확정
 *
 * 적용 대상:
 *   /admin/attendance, /admin/share 등 카카오 운영진도 접근해야 하는 페이지
 */
export function useIsAdminCombined(): boolean | null {
  const [result, setResult] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. cw_admin_session 확인 (httpOnly → API 경유)
      let cookieAdmin = false;
      try {
        const res = await fetch("/api/auth/status");
        const body = await res.json();
        cookieAdmin = body?.isAdmin === true;
      } catch { /* 무시 */ }

      if (cookieAdmin) {
        if (!cancelled) setResult(true);
        return;
      }

      // 2. 카카오 permission_role 확인
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setResult(false);
          return;
        }
        const { data: member } = await supabase
          .from("members")
          .select("permission_role")
          .eq("auth_user_id", session.user.id)
          .eq("club_id", DEFAULT_CLUB_ID)
          .maybeSingle();
        const kakaoAdmin = KAKAO_ADMIN_ROLES.includes(member?.permission_role ?? "");
        if (!cancelled) setResult(kakaoAdmin);
      } catch {
        if (!cancelled) setResult(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return result;
}
