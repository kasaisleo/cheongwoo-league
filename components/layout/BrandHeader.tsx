/**
 * BrandHeader — 플랫폼 브랜드(SUPER MATCH) 텍스트 워드마크 전용 컴포넌트.
 *
 * MemberAuthBar(인증 상태 표시)와 책임을 분리한다 — 이 컴포넌트는 그 어떤
 * 인증/클럽/currentClubId 상태도 갖지 않는 순수 표시 컴포넌트다(props 없음,
 * client component 아님). 로고 이미지가 생기면 이 컴포넌트 내부만 교체하면
 * 되도록 의도적으로 분리했다(Brand-Club-A13/A14).
 *
 * 클럽명(청우회/나마스테)은 여기서 표시하지 않는다 — 클럽명은 홈/로그인
 * eyebrow에서 clubs.name/slug 기반으로 이미 별도로 표시되고 있고, 플랫폼명과
 * 클럽명을 섞지 않는다는 브랜딩 원칙에 따른 것이다.
 */
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="mx-auto max-w-md px-5 pt-4 pb-2">
      <Link href="/">
        <p className="eyebrow-en text-center text-clay-400 tracking-[0.32em] transition-opacity hover:opacity-70">
          SUPER MATCH
        </p>
      </Link>
    </header>
  );
}
