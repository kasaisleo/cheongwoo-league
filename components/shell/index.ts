/**
 * components/shell — Public/Admin Shell Design System
 *
 * 모든 클럽 스킨이 공통으로 사용하는 shell 컴포넌트 모음.
 * 새 skin_key 추가 시 이 컴포넌트들을 그대로 재사용한다.
 * 스킨별 JSX 분기나 컴포넌트 복제 금지.
 *
 * 사용 예:
 *   import { ClubBrandHeader, ClubPageHeader, PublicShell } from "@/components/shell";
 *
 * ─────────────────────────────────────────────────────────
 *  컴포넌트             역할
 * ─────────────────────────────────────────────────────────
 *  PublicShell         /c/[slug] 페이지 공통 <main> wrapper (ShellContent 호환 wrapper)
 *  ShellContent        Public+Admin 공통 <main> wrapper, width variant 지원
 *  ClubBrandHeader     클럽 홈 브랜드 헤더 (logo vs eyebrow)
 *  ClubPageHeader      내부 페이지 표준 헤더 (eyebrow + h1)
 *  AdminClubShell      관리자 페이지 accent 주입 + 로고 wrapper
 *  TopUtilityBar       최상단 유틸리티 바 (로그인/계정/관리자 모드)
 *  ClubBottomNav       하단 탭 내비게이션
 *  DesktopSidebar      >=1024px 데스크톱 사이드바 (Foundation-1: 아직 미연결)
 * ─────────────────────────────────────────────────────────
 */

export { ClubBrandHeader } from "./ClubBrandHeader";
export { ClubPageHeader } from "./ClubPageHeader";
export { PublicShell } from "./PublicShell";
export { ShellContent, type ShellContentWidth } from "./ShellContent";
export { AdminClubShell } from "./AdminClubShell";
export { useShellTransition } from "./ShellTransition";
export { ShellHeader } from "./ShellHeader";
export { DesktopSidebar, type DesktopSidebarItem } from "./DesktopSidebar";

// Canonical naming aliases — 실제 구현은 components/layout/ 에 있음
export { MemberAuthBar as TopUtilityBar } from "@/components/layout/MemberAuthBar";
export { BottomTabBar as ClubBottomNav } from "@/components/layout/BottomTabBar";
