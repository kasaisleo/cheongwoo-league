import type { CSSProperties, ReactNode } from "react";

/**
 * AdminClubShell — 관리자 페이지 accent 주입 + 컨텍스트 로고 wrapper.
 *
 * skinKey → data-admin-skin 속성:
 *   globals.css의 [data-admin-skin="namaste"] 셀렉터로
 *   clay-400 accent 클래스를 --club-primary로 자동 교체.
 *   배경/surface 등 전체 스킨 미적용 (관리자 UI는 독자적 다크 테마 유지).
 *
 * 새 스킨 추가 시 globals.css에 [data-admin-skin="newSkin"] 블록만 추가하면 됨.
 */
interface AdminClubShellProps {
  children: ReactNode;
  /** --club-primary + --club-primary-dark CSS var (accent 색상만) */
  accentVars?: CSSProperties;
  /** @deprecated 사용 안 함 — AdminAccountBar가 담당 */
  logoSrc?: string | null;
  /** @deprecated 사용 안 함 — AdminAccountBar가 담당 */
  clubName?: string | null;
  /** 스킨 키 — data-admin-skin 속성값 */
  skinKey?: string;
}

export function AdminClubShell({ children, accentVars, skinKey }: AdminClubShellProps) {
  return (
    <div
      className="mx-auto min-h-screen max-w-md font-body"
      style={accentVars}
      data-admin-skin={skinKey ?? undefined}
    >
      {children}
    </div>
  );
}
