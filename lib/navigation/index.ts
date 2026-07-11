/**
 * lib/navigation — Public/Admin 공통 navigation config entry point.
 *
 * 사용 예:
 *   import { publicNavigation, buildPublicHref, filterNavItems } from "@/lib/navigation";
 *   import { adminNavigation, isAdminNavItemActive, filterNavItems } from "@/lib/navigation";
 */
export type { NavItemConfig, NavSurface, NavFilterOptions } from "./types";
export { filterNavItems } from "./types";

export { publicNavigation, buildPublicHref, isPublicNavItemActive } from "./publicNavigation";
export { adminNavigation, isAdminNavItemActive } from "./adminNavigation";
