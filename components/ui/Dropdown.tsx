"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

interface DropdownProps {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}

/**
 * Dropdown v2 — Portal 방식으로 z-index 버그 수정.
 *
 * 문제: absolute 패널이 parent의 stacking context(overflow-hidden + relative)에
 *       갇혀 하단 카드에 덮히는 버그.
 * 해결: createPortal로 document.body에 직접 렌더링 + position: fixed로
 *       트리거 위치에 정렬. 어떤 parent도 패널을 clipping할 수 없음.
 */
export function Dropdown({ trigger, children, align = "right", triggerClassName }: DropdownProps) {
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
      className="min-w-[200px] rounded-[14px] border border-line-200/60 bg-line-100 p-1.5 shadow-card"
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
        ? createPortal(panel, document.body)
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
      className="block w-full rounded-sm px-3 py-2 text-left text-sm font-medium text-line-800 transition-colors hover:bg-line-200 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
