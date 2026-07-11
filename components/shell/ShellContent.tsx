import type { ReactNode } from "react";

export type ShellContentWidth = "compact" | "standard" | "wide" | "full";

interface ShellContentProps {
  children: ReactNode;
  /** 콘텐츠 폭 variant. 기본값 "standard". */
  width?: ShellContentWidth;
  /** 기본 클래스 외 추가 클래스 */
  className?: string;
}

/**
 * ShellContent — Public + Admin 공유 <main> content wrapper.
 *
 * 모바일(<1024px, Tailwind `lg` 미만): width variant와 무관하게 항상
 * 100% 폭 + 16px 좌우 padding(px-4)을 사용한다 — 이 부분은 지금 대부분의
 * 페이지가 쓰는 PublicShell(`px-4 pt-6 pb-28`)과 픽셀 단위로 동일하다.
 *
 * 데스크톱(>=1024px): globals.css의 `.shell-content[data-content-width=...]`
 * 규칙이 max-width와 padding-inline(32px gutter)을 적용한다. Foundation-1
 * 시점에는 Public `(public)/layout.tsx`와 Admin `AdminClubShell`이 여전히
 * `max-w-md`로 바깥을 감싸고 있어(제거는 Foundation-2), 이 규칙은 아직
 * 화면에 아무 영향을 주지 않는다 — 상위 wrapper가 항상 더 좁기 때문이다.
 *
 * width="full"은 max-width를 아예 걸지 않는다(향후 Match Console 등
 * Main Column 가용 폭 전체가 필요한 화면용) — Foundation-1에서는 어떤
 * 페이지도 아직 이 값을 쓰지 않는다.
 */
export function ShellContent({ children, width = "standard", className }: ShellContentProps) {
  return (
    <main
      data-content-width={width}
      className={`shell-content px-4 pt-6 pb-28${className ? ` ${className}` : ""}`}
    >
      {children}
    </main>
  );
}
