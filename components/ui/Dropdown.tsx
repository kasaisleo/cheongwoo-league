"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface DropdownProps {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}

/** 트리거를 클릭하면 패널이 펼쳐지는 공용 드롭다운. 바깥을 클릭하면 닫힌다. */
export function Dropdown({ trigger, children, align = "right", triggerClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClassName}>
        {trigger}
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-2 min-w-[200px] rounded-lg border border-line-200 bg-line-100 p-1.5 shadow-card",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
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
      className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-line-800 transition-colors hover:bg-line-200 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
