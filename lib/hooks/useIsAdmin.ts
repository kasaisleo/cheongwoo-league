"use client";

import { useEffect, useState } from "react";

/**
 * 현재 사용자가 운영진 세션인지 클라이언트에서 확인하는 훅.
 *
 * 4곳(MemberDetailActions, MatchCard, attendance/page, attendance/history/page)에
 * 완전히 동일하게 중복되어 있던 `fetch("/api/auth/status")` 패턴을 하나로 모았다.
 * 로딩 중에는(아직 응답이 오지 않았을 때) false를 반환한다 — 기존 각 컴포넌트의
 * `useState(false)` 초기값과 동일한 동작으로, "아직 모름"과 "운영진 아님"을
 * 구분하지 않는다(기존 동작 그대로 유지).
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((body) => setIsAdmin(Boolean(body?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
