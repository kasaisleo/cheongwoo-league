import Link from "next/link";
import { AdminLogoutButton } from "./AdminLogoutButton";

interface AdminAccountBarProps {
  clubName: string | null;
  clubSlug: string | null;
  displayName: string | null;
  role: string | null;
}

/**
 * AdminAccountBar — admin 전용 계정/클럽 상단 표시.
 *
 * 구조:
 *   왼쪽 group  club name · 클럽 홈 링크
 *   오른쪽 group  user name · role badge · logout
 *
 * 색상은 --admin-* CSS 변수만 사용. skin별 JSX 분기 없음.
 * 320px: 왼쪽 group이 min-w-0 shrink로 압축, 오른쪽 group은 flex-shrink-0으로 보장.
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
    <div
      className="flex min-h-[36px] items-center justify-between gap-2 border-b px-4 py-1.5"
      style={{
        background: "var(--admin-bar-bg, #0a1220)",
        borderColor: "var(--admin-border, rgba(30,58,92,0.3))",
      }}
    >
      {/* 왼쪽: club group */}
      <div className="flex min-w-0 shrink items-center gap-2">
        {clubName && (
          <span
            className="truncate text-[11px] font-semibold"
            style={{ color: "var(--admin-muted, #7C92AC)" }}
          >
            {clubName}
          </span>
        )}
        {clubSlug && (
          <Link
            href={`/c/${clubSlug}`}
            className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border px-1.5 py-0.5 text-[9px] font-semibold transition-colors"
            style={{
              borderColor: "var(--admin-border, rgba(30,58,92,0.3))",
              color: "var(--admin-accent, #D4FF3D)",
            }}
          >
            클럽 홈 ↗
          </Link>
        )}
      </div>

      {/* 오른쪽: account group */}
      <div className="flex flex-shrink-0 items-center gap-1.5 pl-1">
        {displayName && (
          <span
            className="max-w-[72px] truncate text-[11px] font-semibold"
            style={{ color: "var(--admin-text, #FFFFFF)" }}
          >
            {displayName}
          </span>
        )}
        <span
          className="rounded-[var(--admin-button-radius,6px)] border px-1.5 py-0.5 text-[9px] font-semibold"
          style={{
            borderColor: "var(--admin-border, rgba(30,58,92,0.3))",
            color: "var(--admin-muted, #7C92AC)",
            background: "var(--admin-surface, #0E1F33)",
          }}
        >
          {roleLabel}
        </span>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
