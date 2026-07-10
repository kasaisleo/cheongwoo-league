import Link from "next/link";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { PlatformHomeLink } from "@/components/navigation/PlatformHomeLink";

interface AdminAccountBarProps {
  clubName: string | null;
  clubSlug: string | null;
  displayName: string | null;
  role: string | null;
}

/**
 * AdminAccountBar — 어드민 2행 헤더.
 *
 * Row 1 (bar-bg): 왼쪽 SUPER MATCH (PlatformHomeLink) | 오른쪽 사용자명 · 권한 · 로그아웃
 * Row 2 (surface): 왼쪽 클럽명 · 관리 중 배지 | 오른쪽 클럽 홈 ↗ 링크
 *
 * 색상은 --admin-* CSS 변수만 사용. skin별 JSX 분기 없음.
 */
export function AdminAccountBar({
  clubName,
  clubSlug,
  displayName,
  role,
}: AdminAccountBarProps) {
  const roleLabel =
    role === "owner" || role === "master"
      ? "Owner"
      : role === "manager"
        ? "Manager"
        : role === "admin"
          ? "Admin"
          : "운영진";

  return (
    <div>
      {/* ── Row 1: Platform + Account ── */}
      <div
        className="flex min-h-[36px] items-center justify-between gap-2 border-b px-4 py-1.5"
        style={{
          background: "var(--admin-bar-bg, #080e1a)",
          borderColor: "var(--admin-border)",
        }}
      >
        {/* SUPER MATCH */}
        <PlatformHomeLink>
          <span
            className="font-display text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "var(--admin-muted)", opacity: 0.65 }}
          >
            SUPER MATCH
          </span>
        </PlatformHomeLink>

        {/* Account group */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {displayName && (
            <span
              className="max-w-[72px] truncate text-[11px] font-semibold"
              style={{ color: "var(--admin-text)" }}
            >
              {displayName}
            </span>
          )}
          <span
            className="rounded-[var(--admin-button-radius,6px)] border px-1.5 py-0.5 text-[9px] font-semibold"
            style={{
              borderColor: "var(--admin-border)",
              color: "var(--admin-muted)",
              background: "var(--admin-surface)",
            }}
          >
            {roleLabel}
          </span>
          <AdminLogoutButton />
        </div>
      </div>

      {/* ── Row 2: Club Context ── */}
      <div
        className="flex min-h-[32px] items-center justify-between gap-2 border-b px-4 py-1"
        style={{
          background: "var(--admin-surface, #172235)",
          borderColor: "var(--admin-border)",
        }}
      >
        {/* Club + status */}
        <div className="flex min-w-0 items-center gap-2">
          {clubName && (
            <span
              className="truncate text-[11px] font-semibold"
              style={{ color: "var(--admin-text)" }}
            >
              {clubName}
            </span>
          )}
          <span
            className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border px-1.5 py-0.5 text-[9px] font-semibold"
            style={{
              borderColor: "var(--admin-accent)",
              background: "var(--admin-accent-soft)",
              color: "var(--admin-accent)",
            }}
          >
            관리 중
          </span>
        </div>

        {/* Club home link */}
        {clubSlug && (
          <Link
            href={`/c/${clubSlug}`}
            className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border px-1.5 py-0.5 text-[9px] font-semibold transition-opacity hover:opacity-70"
            style={{
              borderColor: "var(--admin-border)",
              color: "var(--admin-muted)",
            }}
          >
            클럽 홈 ↗
          </Link>
        )}
      </div>
    </div>
  );
}
