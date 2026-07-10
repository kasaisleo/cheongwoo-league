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
 * public MemberAuthBar와 완전히 분리된 서버 컴포넌트.
 * admin session(cw_admin_session + admin_club_slug) 기준 데이터만 표시.
 * public 회원 이름·마이페이지 링크 없음.
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
      className="flex items-center justify-between border-b border-line-200/20 px-4 py-2"
      style={{ background: "var(--admin-bar-bg, #0a1220)" }}
    >
      {/* 왼쪽: 클럽명 + 공개 홈 */}
      <div className="flex items-center gap-2 min-w-0">
        {clubName && (
          <span className="truncate text-[11px] font-semibold text-line-400">
            {clubName}
          </span>
        )}
        {clubSlug && (
          <Link
            href={`/c/${clubSlug}`}
            className="flex-shrink-0 rounded-[var(--admin-button-radius,6px)] border border-line-200/30 px-1.5 py-0.5 text-[9px] font-semibold text-line-500 hover:text-line-300 transition-colors"
          >
            공개 홈 ↗
          </Link>
        )}
      </div>

      {/* 오른쪽: 사용자 + 역할 + 로그아웃 */}
      <div className="flex flex-shrink-0 items-center gap-2 pl-2">
        {displayName && (
          <span className="text-[11px] font-semibold text-line-300">
            {displayName}
          </span>
        )}
        <span className="rounded-[var(--admin-button-radius,6px)] border border-line-200/30 bg-line-100/10 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
          {roleLabel}
        </span>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
