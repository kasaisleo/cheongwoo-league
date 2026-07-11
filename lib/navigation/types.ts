/**
 * lib/navigation/types.ts — Public/Admin 공통 navigation config 타입.
 *
 * Public과 Admin은 route 생성 방식이 다르다(Public=slug 파라미터화 필요,
 * Admin=고정 경로) — 그래서 이 타입은 "무엇을 보여줄지"만 표현하고,
 * href 생성은 각 config 파일의 헬퍼(buildPublicHref / isAdminNavItemActive)에
 * 위임한다. NavItemConfig 자체는 mode-agnostic.
 */
export interface NavItemConfig {
  id: string;
  label: string;
  /**
   * Public: `/c/[slug]` 뒤에 붙는 path suffix ("" = 클럽 홈).
   * Admin: `/admin`부터 시작하는 절대 경로.
   */
  path: string;
  /** Mobile Bottom Nav에 노출할지 */
  showOnMobile: boolean;
  /** Desktop Sidebar에 노출할지 */
  showOnDesktop: boolean;
  /** true면 정확히 일치할 때만 active, false/미지정이면 startsWith로 판정 */
  exactMatch?: boolean;
  /** true면 owner(master)만 노출 */
  ownerOnly?: boolean;
}

export type NavSurface = "mobile" | "desktop";

export interface NavFilterOptions {
  surface: NavSurface;
  /** ownerOnly 항목 노출 여부 판단용. 없으면 ownerOnly 항목은 제외된다. */
  isOwner?: boolean;
}

/** surface(mobile/desktop) + 권한 조건에 맞는 항목만 순서 유지하며 필터링 */
export function filterNavItems(
  items: NavItemConfig[],
  options: NavFilterOptions
): NavItemConfig[] {
  return items.filter((item) => {
    if (options.surface === "mobile" && !item.showOnMobile) return false;
    if (options.surface === "desktop" && !item.showOnDesktop) return false;
    if (item.ownerOnly && !options.isOwner) return false;
    return true;
  });
}
