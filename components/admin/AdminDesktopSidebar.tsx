"use client";

import { usePathname } from "next/navigation";
import { DesktopSidebar } from "@/components/shell/DesktopSidebar";
import { adminNavigation, isAdminNavItemActive, filterNavItems } from "@/lib/navigation";

interface AdminDesktopSidebarProps {
  isOwner: boolean;
}

/**
 * AdminDesktopSidebar — adminNavigation config를 실제 pathname 기준으로
 * DesktopSidebar item으로 변환하는 client 연결부.
 *
 * Admin route는 slug interpolation이 필요 없다(club context는 항상
 * admin_club_slug 쿠키 + access.clubId) — item.path를 href로 그대로 사용.
 * ownerOnly(설정) 항목은 isOwner로 필터링.
 */
export function AdminDesktopSidebar({ isOwner }: AdminDesktopSidebarProps) {
  const pathname = usePathname();

  const items = filterNavItems(adminNavigation, { surface: "desktop", isOwner }).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.path,
    active: isAdminNavItemActive(pathname, item),
  }));

  return <DesktopSidebar items={items} ariaLabel="관리자 메뉴" />;
}
