import type { ReactNode } from "react";
import { ShellContent } from "./ShellContent";

/**
 * PublicShell — /c/[slug] 공개 페이지 표준 main wrapper.
 *
 * ShellContent(width="standard")의 호환 wrapper. 기존 페이지들을 일괄
 * 교체하지 않고 점진적으로 ShellContent 직접 사용으로 옮겨가기 위해
 * 유지한다 — px-4 pt-6 pb-28 결과물은 이전과 픽셀 단위로 동일하다.
 * 신규 페이지는 PublicShell 대신 ShellContent를 직접 사용한다.
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
    <ShellContent width="standard" className={className}>
      {children}
    </ShellContent>
  );
}
