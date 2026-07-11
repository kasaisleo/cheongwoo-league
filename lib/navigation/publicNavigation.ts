/**
 * lib/navigation/publicNavigation.ts — Public(`/c/[slug]`) navigation config.
 *
 * Mobile Bottom Nav 구성(기존 components/layout/BottomTabBar.tsx의 5탭)과
 * 동일 항목을 유지하고, Desktop Sidebar에서만 "랭킹"을 추가로 노출한다.
 * 존재하지 않는 route는 추가하지 않는다.
 */
import type { NavItemConfig } from "./types";

export const publicNavigation: NavItemConfig[] = [
  { id: "home", label: "홈", path: "", showOnMobile: true, showOnDesktop: true, exactMatch: true },
  { id: "attendance", label: "매치", path: "/attendance", showOnMobile: true, showOnDesktop: true },
  { id: "matches", label: "기록", path: "/matches", showOnMobile: true, showOnDesktop: true },
  { id: "members", label: "회원", path: "/members", showOnMobile: true, showOnDesktop: true },
  { id: "ranking", label: "랭킹", path: "/ranking", showOnMobile: false, showOnDesktop: true },
  { id: "mypage", label: "마이", path: "/mypage", showOnMobile: true, showOnDesktop: true },
];

/** Public route href 생성 — slug는 항상 호출부가 명시적으로 전달한다(추정 금지). */
export function buildPublicHref(slug: string, item: NavItemConfig): string {
  return item.path ? `/c/${slug}${item.path}` : `/c/${slug}`;
}

export function isPublicNavItemActive(
  pathname: string,
  slug: string,
  item: NavItemConfig
): boolean {
  const href = buildPublicHref(slug, item);
  return item.exactMatch ? pathname === href : pathname.startsWith(href);
}
