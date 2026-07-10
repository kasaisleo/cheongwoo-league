"use client";

import { useEffect, type ReactNode } from "react";
import { PlatformHomeLink } from "@/components/navigation/PlatformHomeLink";
import { clearTransitionIntent } from "@/components/shell/ShellTransition";

interface ShellHeaderProps {
  row1Right: ReactNode;
  row2Left?: ReactNode;
  row2Right?: ReactNode;
  exiting?: boolean;
  hideRow2?: boolean;
}

/**
 * ShellHeader — Public + Admin 공유 2-row 헤더 geometry wrapper.
 *
 * Row 1: SUPER MATCH (left, hardcoded) | row1Right (right slot)
 * Row 2: row2Left (left slot) | row2Right (right slot)
 *   → hideRow2={true} 시 Row 2 미렌더링.
 *
 * 색상: --shell-row1-bg, --shell-row2-bg, --shell-row-border, --shell-brand-color
 *   Public: :root 기본값 (--club-* 기준)
 *   Admin:  AdminClubShell ADMIN_SKIN_VARS에서 오버라이드 (--admin-* 기준)
 * geometry: --shell-* 토큰 100% 소비. skinKey 불인지 — CSS vars만 소비.
 * 전환: mount 시 clearTransitionIntent (sessionStorage cleanup).
 */
export function ShellHeader({
  row1Right,
  row2Left,
  row2Right,
  exiting = false,
  hideRow2 = false,
}: ShellHeaderProps) {
  const rowCls = `shell-row-enter${exiting ? " shell-row-exiting" : ""}`;

  useEffect(() => {
    const id = setTimeout(clearTransitionIntent, 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      {/* ── Row 1: SUPER MATCH | row1Right slot ─────────────────────── */}
      <div
        className={rowCls}
        style={{
          background: "var(--shell-row1-bg)",
          borderBottom: "1px solid var(--shell-row-border)",
        }}
      >
        <div
          className="mx-auto flex max-w-md items-center justify-between"
          style={{
            minHeight: "var(--shell-row1-h)",
            paddingInline: "var(--shell-px)",
            gap: "var(--shell-gap)",
          }}
        >
          <PlatformHomeLink>
            <span
              className="font-display font-bold uppercase whitespace-nowrap"
              style={{
                fontSize: "var(--shell-brand-size)",
                letterSpacing: "var(--shell-brand-track)",
                color: "var(--shell-brand-color)",
                opacity: 0.65,
              }}
            >
              SUPER MATCH
            </span>
          </PlatformHomeLink>
          <div
            className="flex flex-shrink-0 items-center"
            style={{ gap: "var(--shell-gap)" }}
          >
            {row1Right}
          </div>
        </div>
      </div>

      {/* ── Row 2: row2Left slot | row2Right slot ───────────────────── */}
      {!hideRow2 && (
        <div
          className={rowCls}
          style={{
            background: "var(--shell-row2-bg)",
            borderBottom: "1px solid var(--shell-row-border)",
          }}
        >
          <div
            className="mx-auto flex max-w-md items-center justify-between"
            style={{
              minHeight: "var(--shell-row2-h)",
              paddingInline: "var(--shell-px)",
              gap: "var(--shell-gap)",
            }}
          >
            <div
              className="flex min-w-0 items-center"
              style={{ gap: "var(--shell-gap)" }}
            >
              {row2Left}
            </div>
            <div
              className="flex flex-shrink-0 items-center"
              style={{ gap: "var(--shell-gap)" }}
            >
              {row2Right}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
