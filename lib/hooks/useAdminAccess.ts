"use client";

import { useEffect, useState } from "react";
import { getAdminAccessClient, type AdminAccess } from "@/lib/admin-permissions";

/**
 * useAdminAccess() — 클라이언트 컴포넌트용 통합 관리자 권한 훅.
 *
 * null  = 로딩 중 (아직 판단 불가)
 * AdminAccess = 판단 완료 (isAdmin, isOwner 등 참조)
 *
 * 사용처:
 *   - app/admin/attendance/page.tsx
 *   - app/admin/settings/page.tsx
 *   - app/members/new/page.tsx
 *   기타 클라이언트 관리자 페이지 전체
 */
export function useAdminAccess(): AdminAccess | null {
  const [access, setAccess] = useState<AdminAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminAccessClient().then((result) => {
      if (!cancelled) setAccess(result);
    });
    return () => { cancelled = true; };
  }, []);

  return access;
}
