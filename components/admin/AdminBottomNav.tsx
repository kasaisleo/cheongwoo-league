"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminBottomNavProps {
  isOwner: boolean;
}

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "대시보드",
    exact: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M7 18v-7h6v7" />
      </svg>
    ),
  },
  {
    href: "/admin/matches",
    label: "매치",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <path d="M5.5 5.5c2.5 1 3.5 3 4.5 4.5s2 3.5 4.5 4.5" />
        <path d="M14.5 5.5c-2.5 1-3.5 3-4.5 4.5S8 13.5 5.5 14.5" />
      </svg>
    ),
  },
  {
    href: "/admin/attendance",
    label: "출석",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M3 8h14" />
        <path d="M7 2v4M13 2v4" />
        <path d="M7 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/records",
    label: "기록",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 10h6M7 13h4M7 7h3" />
      </svg>
    ),
  },
] as const;

const SETTINGS_ITEM = {
  href: "/admin/settings",
  label: "설정",
  exact: false,
  icon: (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4" />
    </svg>
  ),
} as const;

/**
 * AdminBottomNav — /admin 전용 하단 네비게이션.
 *
 * - --admin-bg / --admin-border / --admin-muted / --admin-accent: AdminClubShell에서 주입
 * - active state: var(--admin-accent)
 * - inactive state: var(--admin-muted)
 * - safe area: <nav> 컨테이너에 pb-[env(safe-area-inset-bottom)] (public BottomTabBar 동일 패턴)
 * - icon: 22×22px (viewBox 0 0 20 20 유지), strokeWidth 1.6
 * - label: .nav-label-kr (10px/700/Noto Sans KR, public 동일)
 * - active top indicator: Link에 relative 기준
 */
export function AdminBottomNav({ isOwner }: AdminBottomNavProps) {
  const pathname = usePathname();
  const items = isOwner ? [...NAV_ITEMS, SETTINGS_ITEM] : [...NAV_ITEMS];

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="관리자 메뉴"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{
        background: "var(--admin-bg, #0f1523)",
        borderTop: "1px solid var(--admin-border, rgba(255,255,255,0.06))",
      }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          const color = active
            ? "var(--admin-accent, #D4FF3D)"
            : "var(--admin-muted, rgba(255,255,255,0.35))";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative shell-bottom-tab transition-colors"
              style={{ color }}
            >
              {active && (
                <span
                  className="shell-bottom-indicator"
                  style={{ background: "var(--admin-accent, #D4FF3D)", opacity: 0.8 }}
                  aria-hidden="true"
                />
              )}
              {item.icon}
              <span className="nav-label-kr" style={{ color }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
