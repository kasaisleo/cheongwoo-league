"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * useShellTransition — Public ↔ Admin 전환 시 header exit animation 후 navigate.
 *
 * 사용법:
 *   const { navigate, exiting } = useShellTransition();
 *   // shell row에 exiting 상태 전달 → .shell-row-exiting 클래스 적용
 *   // navigate(href) 호출 → 120ms exit 후 router.push 또는 location.assign
 *
 * 보장:
 *   - 중복 클릭 방지 (locked ref)
 *   - prefers-reduced-motion: 즉시 navigate (0ms exit)
 *   - 2000ms safety: navigate 실패 시 exiting 상태 자동 복구
 *   - skin별 animation 분기 없음
 */
const INTENT_KEY = "shell-transition-intent";

export function clearTransitionIntent(): void {
  try { sessionStorage.removeItem(INTENT_KEY); } catch { /* 무시 */ }
}

function setTransitionIntent(): void {
  try { sessionStorage.setItem(INTENT_KEY, "1"); } catch { /* 무시 */ }
}

export function useShellTransition() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);
  const locked = useRef(false);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * navigate(href) — App Router soft navigation용 (cross-layout 포함).
   * API route redirect가 필요한 경우 (admin enter) navigateHard를 사용.
   */
  const navigate = useCallback(
    (href: string) => {
      if (locked.current) return;
      locked.current = true;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const exitMs = reduced ? 0 : 120;

      setExiting(true);

      setTransitionIntent();
      setTimeout(() => {
        router.push(href);
        safetyRef.current = setTimeout(() => {
          setExiting(false);
          locked.current = false;
        }, 2000);
      }, exitMs);
    },
    [router],
  );

  /**
   * navigateHard(href) — 쿠키 설정이 필요한 API route redirect용.
   * window.location.assign()으로 전체 페이지 이동.
   * (예: /api/admin/enter?club=namaste → 302 → /admin)
   */
  const navigateHard = useCallback(
    (href: string) => {
      if (locked.current) return;
      locked.current = true;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const exitMs = reduced ? 0 : 120;

      setExiting(true);
      setTransitionIntent();

      setTimeout(() => {
        window.location.assign(href);
        // hard navigation으로 현재 JS context 파괴되므로 safety reset 불필요
      }, exitMs);
    },
    [],
  );

  return { navigate, navigateHard, exiting };
}
