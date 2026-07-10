import type { CSSProperties, ReactNode } from "react";

/**
 * AdminClubShell — 관리자 페이지 accent 주입 + 컨텍스트 로고 wrapper.
 *
 * skinKey → data-admin-skin 속성:
 *   globals.css의 [data-admin-skin="namaste"] 셀렉터로
 *   clay-400 accent 클래스를 --club-primary로 자동 교체.
 *
 * skinKey → ADMIN_SKIN_VARS:
 *   --admin-bg/surface/text/muted/border/accent/button-radius/card-radius 등
 *   어드민 전용 토큰을 per-skin으로 주입.
 *   Public의 --club-* 토큰과 별도 namespace.
 *
 * 배경/surface 등은 --admin-* 토큰 기준.
 * accent(clay-400 클래스 오버라이드)는 기존 [data-admin-skin] CSS selector 유지.
 */

interface AdminClubShellProps {
  children: ReactNode;
  /** --club-primary + --club-primary-dark CSS var (기존 clay-400 오버라이드용) */
  accentVars?: CSSProperties;
  /** @deprecated 사용 안 함 — AdminAccountBar가 담당 */
  logoSrc?: string | null;
  /** @deprecated 사용 안 함 — AdminAccountBar가 담당 */
  clubName?: string | null;
  /** 스킨 키 — data-admin-skin 속성값 및 admin token 분기 기준 */
  skinKey?: string;
}

const ADMIN_SKIN_VARS: Record<string, Record<string, string>> = {
  default: {
    "--admin-bg":             "#111827",
    "--admin-bar-bg":         "#080e1a",
    "--admin-surface":        "#172235",
    "--admin-surface-raised": "#1e2f47",
    "--admin-surface-strong": "#223350",
    "--admin-text":           "#e2e8f0",
    "--admin-muted":          "rgba(255,255,255,0.35)",
    "--admin-border":         "rgba(255,255,255,0.10)",
    "--admin-border-strong":  "rgba(255,255,255,0.22)",
    "--admin-accent":         "#D4FF3D",
    "--admin-accent-soft":    "rgba(212,255,61,0.1)",
    "--admin-achievement":    "#D4FF3D",
    "--admin-button-radius":  "6px",
    "--admin-card-radius":    "10px",
    "--admin-focus-ring":     "rgba(212,255,61,0.45)",
    "--shell-brand-color":    "var(--admin-muted)",
    "--shell-row-border":     "var(--admin-border)",
    "--shell-row1-bg":        "var(--admin-bar-bg)",
    "--shell-row2-bg":        "var(--admin-surface)",
  },
  cheongwoo: {
    "--admin-bg":             "#111827",
    "--admin-bar-bg":         "#080e1a",
    "--admin-surface":        "#172235",
    "--admin-surface-raised": "#1e2f47",
    "--admin-surface-strong": "#223350",
    "--admin-text":           "#e2e8f0",
    "--admin-muted":          "rgba(255,255,255,0.35)",
    "--admin-border":         "rgba(255,255,255,0.10)",
    "--admin-border-strong":  "rgba(255,255,255,0.22)",
    "--admin-accent":         "#D4FF3D",
    "--admin-accent-soft":    "rgba(212,255,61,0.1)",
    "--admin-achievement":    "#D4FF3D",
    "--admin-button-radius":  "6px",
    "--admin-card-radius":    "10px",
    "--admin-focus-ring":     "rgba(212,255,61,0.45)",
    "--shell-brand-color":    "var(--admin-muted)",
    "--shell-row-border":     "var(--admin-border)",
    "--shell-row1-bg":        "var(--admin-bar-bg)",
    "--shell-row2-bg":        "var(--admin-surface)",
  },
  namaste: {
    "--admin-bg":             "#1e1232",
    "--admin-bar-bg":         "#150c25",
    "--admin-surface":        "#2e1a4a",
    "--admin-surface-raised": "#3a2158",
    "--admin-surface-strong": "#432565",
    "--admin-text":           "#ecddf5",
    "--admin-muted":          "rgba(236,221,245,0.45)",
    "--admin-border":         "rgba(180,140,210,0.28)",
    "--admin-border-strong":  "rgba(180,140,210,0.50)",
    "--admin-accent":         "#b07fd8",
    "--admin-accent-soft":    "rgba(176,127,216,0.18)",
    "--admin-achievement":    "#c9a84c",
    "--admin-button-radius":  "13px",
    "--admin-card-radius":    "16px",
    "--admin-focus-ring":     "rgba(176,127,216,0.45)",
    "--shell-brand-color":    "var(--admin-muted)",
    "--shell-row-border":     "var(--admin-border)",
    "--shell-row1-bg":        "var(--admin-bar-bg)",
    "--shell-row2-bg":        "var(--admin-surface)",
  },
};

export function AdminClubShell({ children, accentVars, skinKey }: AdminClubShellProps) {
  const skinTokens = ADMIN_SKIN_VARS[skinKey ?? "default"] ?? ADMIN_SKIN_VARS.default;
  const mergedVars = { ...skinTokens, ...accentVars } as CSSProperties;

  return (
    <div
      className="mx-auto min-h-screen max-w-md font-body"
      style={{
        background: "var(--admin-bg)",
        color: "var(--admin-text)",
        ...mergedVars,
      }}
      data-admin-skin={skinKey ?? undefined}
    >
      {children}
    </div>
  );
}
