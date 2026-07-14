"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

interface DropdownProps {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}

/**
 * Dropdown이 패널을 portal할 대상 DOM 노드.
 *
 * Admin: AdminClubShell이 스킨 CSS 변수가 적용된 자기 하위에 portal root를
 *   두고 이 Context로 제공한다 — 패널이 AdminClubShell의 inline-style
 *   스킨 변수를 실제 DOM 상속으로 받기 위함(admin-dropdown-portal-alignment).
 * Public: Provider가 없으므로 null → 기존과 동일하게 document.body 사용.
 */
export const DropdownPortalContext = createContext<HTMLElement | null>(null);

/**
 * Dropdown v2 — Portal 방식으로 z-index 버그 수정.
 *
 * 문제: absolute 패널이 parent의 stacking context(overflow-hidden + relative)에
 *       갇혀 하단 카드에 덮히는 버그.
 * 해결: createPortal로 document.body(또는 DropdownPortalContext가 제공하는
 *       스킨 스코프 노드)에 직접 렌더링 + position: fixed로 트리거 위치에
 *       정렬. 어떤 parent도 패널을 clipping할 수 없음.
 */
export function Dropdown({ trigger, children, align = "right", triggerClassName }: DropdownProps) {
  const portalTarget = useContext(DropdownPortalContext);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // 트리거 열릴 때 좌표 계산
  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: align === "right" ? rect.right + window.scrollX : rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      close();
    }
    function handleScroll() { close(); }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [open, close]);

  const panel = open ? (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: coords.top,
        left: align === "right" ? "auto" : coords.left,
        right: align === "right" ? `calc(100vw - ${coords.left + coords.width}px + ${window.scrollX}px)` : "auto",
        minWidth: coords.width,
        zIndex: 9999,
      }}
      className="min-w-[200px] rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-1.5 shadow-card"
    >
      {children(close)}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, portalTarget ?? document.body)
        : null}
    </>
  );
}

interface DropdownItemProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function DropdownItem({ onClick, disabled, children }: DropdownItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full rounded-sm px-3 py-2 text-left text-sm font-medium text-[color:var(--surface-text)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--surface-bg-raised)_85%,white)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
