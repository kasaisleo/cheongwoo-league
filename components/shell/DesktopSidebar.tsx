import type { ReactNode } from "react";
import Link from "next/link";

export interface DesktopSidebarItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  icon?: ReactNode;
}

interface DesktopSidebarProps {
  items: DesktopSidebarItem[];
  /** <nav aria-label="..."> — Public/Admin이 각자 의미 있는 라벨을 전달한다. */
  ariaLabel: string;
  /** 사이드바 하단 슬롯 (계정 정보 등, Foundation-1에서는 미사용) */
  footer?: ReactNode;
}

/**
 * DesktopSidebar — Public/Admin 공유 데스크톱 사이드바 (>=1024px, Tailwind `lg`).
 *
 * ⚠ Foundation-1 시점: 이 컴포넌트는 어떤 layout에도 아직 연결되지 않는다.
 *   Public `(public)/layout.tsx`, Admin `AdminClubShell`/`AdminGatewayShell`이
 *   여전히 max-w-md로 전체를 감싸고 있어 실제 렌더 시에도 `lg:flex` 조건이
 *   충족될 여지가 없다(부모가 항상 448px). 연결은 Foundation-2에서 진행한다.
 *
 * anatomy:
 *   - position: sticky (fixed 아님), top: 0, height/min-height: 100dvh
 *   - width: var(--sidebar-width) 고정 — 접힘 기능 없음(최초 구현 범위 제외)
 *   - <1024px: hidden (Mobile Bottom Nav가 대신 노출)
 *   - 각 항목: aria-current="page" (active일 때만), focus-visible outline
 *
 * 색상은 --shell-sidebar-* 토큰만 소비한다 — Public(:root 기본값)과
 * Admin(AdminClubShell에서 --admin-* 기준 오버라이드) 양쪽에서 스킨 JSX
 * 분기 없이 자동으로 올바른 색이 적용된다.
 */
export function DesktopSidebar({ items, ariaLabel, footer }: DesktopSidebarProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="desktop-sidebar hidden lg:flex lg:flex-col lg:flex-shrink-0"
      style={{
        width: "var(--sidebar-width)",
        minHeight: "100dvh",
        height: "100dvh",
        position: "sticky",
        top: 0,
        background: "var(--shell-sidebar-bg)",
        borderRight: "1px solid var(--shell-sidebar-border)",
      }}
    >
      <ul className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className="desktop-sidebar-link flex items-center gap-2 rounded-[var(--club-button-radius,6px)] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                color: item.active ? "var(--shell-sidebar-active-text)" : "var(--shell-sidebar-muted)",
                background: item.active ? "var(--shell-sidebar-active-bg)" : "transparent",
                outlineColor: "var(--shell-sidebar-active-text)",
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {footer}
    </nav>
  );
}
