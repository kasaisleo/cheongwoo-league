"use client";

import { useEffect, useState } from "react";
import type { AdminRole } from "@/lib/admin-auth";

/**
 * 현재 사용자의 운영진 역할(owner/manager)을 클라이언트에서 확인하는 훅.
 *
 * useIsAdmin()과 같은 /api/auth/status를 호출하지만, "운영진인지 여부"만
 * 보는 게 아니라 구체적인 role이 필요한 owner 전용 UI(직책 select 등)에서
 * 쓴다. 로딩 중이거나 비로그인이면 null을 반환한다 — useIsAdmin()의 false와
 * 같은 "아직 모름/권한 없음"을 구분하지 않는 보수적 기본값이다.
 */
export function useAdminRole(): AdminRole | null {
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((body) => setRole(body?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  return role;
}
