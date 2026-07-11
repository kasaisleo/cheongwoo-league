"use client";

import { usePathname } from "next/navigation";
import { DesktopSidebar } from "@/components/shell/DesktopSidebar";
import {
  publicNavigation,
  buildPublicHref,
  isPublicNavItemActive,
  filterNavItems,
} from "@/lib/navigation";

function extractSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * PublicDesktopSidebar — publicNavigation config를 실제 pathname/slug 기준으로
 * DesktopSidebar item으로 변환하는 client 연결부.
 *
 * slug가 없는 페이지("/", "/login" 등)는 club 메뉴를 만들 근거가 없으므로
 * sidebar를 렌더하지 않는다 — club context를 임의로 추정하지 않는다는
 * 기존 원칙(BottomTabBar의 lastClubSlug 폴백과 달리, sidebar는 추정 없이
 * 안전하게 미노출을 선택한다).
 */
export function PublicDesktopSidebar() {
  const pathname = usePathname();
  const slug = extractSlugFromPath(pathname);

  if (!slug) return null;

  const items = filterNavItems(publicNavigation, { surface: "desktop" }).map((item) => ({
    id: item.id,
    label: item.label,
    href: buildPublicHref(slug, item),
    active: isPublicNavItemActive(pathname, slug, item),
  }));

  return <DesktopSidebar items={items} ariaLabel="Public 메뉴" />;
}
