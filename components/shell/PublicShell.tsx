import type { ReactNode } from "react";

/**
 * PublicShell — /c/[slug] 공개 페이지 표준 main wrapper.
 *
 * px-4 pt-6 pb-28: 좌우 패딩 + 상단 여백 + BottomTabBar(56px) 공간 확보.
 * 스킨과 무관하게 모든 공개 페이지에서 동일하게 사용한다.
 *
 * 스킨 CSS 변수는 상위 layout.tsx의 [data-club-skin] wrapper에서 주입되므로
 * 여기서 별도 처리가 필요 없다.
 */
interface PublicShellProps {
  children: ReactNode;
  /** 기본 클래스 외 추가 클래스 (예: "overflow-hidden") */
  className?: string;
}

export function PublicShell({ children, className }: PublicShellProps) {
  return (
    <main className={`px-4 pt-6 pb-28${className ? ` ${className}` : ""}`}>
      {children}
    </main>
  );
}
