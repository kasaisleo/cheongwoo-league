"use client";

import { AdminLogoutButton } from "./AdminLogoutButton";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { useShellTransition } from "@/components/shell/ShellTransition";

interface AdminAccountBarProps {
  clubName: string | null;
  clubSlug: string | null;
  displayName: string | null;
  role: string | null;
}

/**
 * AdminAccountBar v3 — ShellHeader 기반 slot 주입.
 *
 * Row 1: SUPER MATCH (ShellHeader hardcoded) | 사용자명 · 권한 · 로그아웃 (right slot)
 * Row 2: 클럽명 + 관리 중 배지 (left slot) | 클럽 홈 ↗ (right slot)
 *
 * 색상: --admin-* CSS vars.  geometry: --shell-* CSS vars (via ShellHeader).
 * 전환: useShellTransition → 120ms exit → router.push(/c/[slug]).
 */
export function AdminAccountBar({
  clubName,
  clubSlug,
  displayName,
  role,
}: AdminAccountBarProps) {
  const { navigate, exiting } = useShellTransition();

  const roleLabel =
    role === "owner" || role === "master"
      ? "Owner"
      : role === "manager"
        ? "Manager"
        : role === "admin"
          ? "Admin"
          : "운영진";

  // ── Row 1 right slot ─────────────────────────────────────────────────
  const row1Right = (
    <>
      {displayName && (
        <span
          className="max-w-[72px] truncate font-semibold whitespace-nowrap"
          style={{ fontSize: "var(--shell-user-size)", color: "var(--admin-text)" }}
        >
          {displayName}
        </span>
      )}
      <span
        className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border font-semibold whitespace-nowrap"
        style={{
          fontSize: "var(--shell-action-size)",
          paddingBlock: "var(--shell-pill-py)",
          paddingInline: "var(--shell-pill-px)",
          borderColor: "var(--admin-border)",
          background: "var(--admin-surface)",
          color: "var(--admin-muted)",
        }}
      >
        {roleLabel}
      </span>
      <AdminLogoutButton />
    </>
  );

  // ── Row 2 left: 클럽명 + 관리 중 배지 ──────────────────────────────
  const row2Left = (
    <>
      {clubName && (
        <span
          className="truncate font-semibold whitespace-nowrap"
          style={{ fontSize: "var(--shell-club-size)", color: "var(--admin-text)" }}
        >
          {clubName}
        </span>
      )}
      <span
        className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border font-semibold whitespace-nowrap"
        style={{
          fontSize: "var(--shell-action-size)",
          paddingBlock: "var(--shell-pill-py)",
          paddingInline: "var(--shell-pill-px)",
          borderColor: "var(--admin-accent)",
          background: "var(--admin-accent-soft)",
          color: "var(--admin-accent)",
        }}
      >
        관리 중
      </span>
    </>
  );

  // ── Row 2 right: 클럽 홈 ↗ ──────────────────────────────────────────
  const row2Right = clubSlug ? (
    <button
      type="button"
      onClick={() => navigate(`/c/${clubSlug}`)}
      disabled={exiting}
      className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border font-semibold whitespace-nowrap transition-opacity hover:opacity-70 disabled:pointer-events-none"
      style={{
        fontSize: "var(--shell-action-size)",
        paddingBlock: "var(--shell-pill-py)",
        paddingInline: "var(--shell-pill-px)",
        borderColor: "var(--admin-border)",
        color: "var(--admin-muted)",
      }}
    >
      클럽 홈 ↗
    </button>
  ) : null;

  return (
    <ShellHeader
      row1Right={row1Right}
      row2Left={row2Left}
      row2Right={row2Right}
      exiting={exiting}
    />
  );
}
