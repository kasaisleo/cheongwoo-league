/**
 * lib/navigation/adminNavigation.ts — Admin(`/admin`) navigation config.
 *
 * Admin route는 slug를 포함하지 않는다 — club context는 항상
 * admin_club_slug 쿠키 + getAdminAccessServer().clubId로 결정되고, URL은
 * 고정 경로다. Mobile Bottom Nav 구성(기존 components/admin/AdminBottomNav.tsx의
 * 4~5탭)과 동일 항목을 유지하고, Desktop Sidebar에서만 "회원관리"·"게스트"를
 * 추가로 노출한다. 존재하지 않는 route는 추가하지 않는다.
 */
import type { NavItemConfig } from "./types";

export const adminNavigation: NavItemConfig[] = [
  { id: "dashboard", label: "대시보드", path: "/admin", showOnMobile: true, showOnDesktop: true, exactMatch: true },
  { id: "members", label: "회원관리", path: "/admin/members", showOnMobile: false, showOnDesktop: true },
  { id: "matches", label: "매치", path: "/admin/matches", showOnMobile: true, showOnDesktop: true },
  { id: "attendance", label: "출석", path: "/admin/attendance", showOnMobile: true, showOnDesktop: true },
  { id: "records", label: "기록", path: "/admin/records", showOnMobile: true, showOnDesktop: true },
  { id: "guests", label: "게스트", path: "/admin/guests", showOnMobile: false, showOnDesktop: true },
  { id: "settings", label: "설정", path: "/admin/settings", showOnMobile: true, showOnDesktop: true, ownerOnly: true },
];

/** Admin route href는 고정 경로 그대로 사용 — item.path가 곧 href. */
export function isAdminNavItemActive(pathname: string, item: NavItemConfig): boolean {
  return item.exactMatch ? pathname === item.path : pathname.startsWith(item.path);
}
