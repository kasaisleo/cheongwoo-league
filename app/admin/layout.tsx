/**
 * app/admin/layout.tsx — 관리자 영역 공통 레이아웃.
 *
 * 폰트 정책:
 *   - 기본(body): Noto Sans KR (font-body — app/layout.tsx에서 이미 적용)
 *   - 관리자 wrapper에서 font-body를 명시적으로 재확인
 *   - Oswald(font-display)는 숫자·상태값·독립 영문 라벨에만 명시적으로 사용
 *   - 선수명·회원명·버튼·설명문은 Noto Sans KR 유지
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-body">
      {children}
    </div>
  );
}
