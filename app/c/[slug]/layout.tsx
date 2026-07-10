import type { ReactNode, CSSProperties } from "react";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { getClubSkin } from "@/lib/club-skin";

/**
 * /c/[slug] 공개 클럽 페이지 공통 레이아웃.
 *
 * 역할:
 *  - clubs.skin_key → ClubSkin 해석
 *  - data-club-skin attribute와 CSS 변수를 하위 페이지 전체에 주입
 *  - requirePublicClubBySlug는 React cache()로 래핑되어 있으므로
 *    하위 page.tsx에서 재호출해도 DB 쿼리는 추가 발생하지 않는다
 *
 * CSS 변수 (globals.css에서 사용 가능):
 *   var(--club-accent)   — 주 액센트 (기본: clay-400 #D4FF3D)
 *   var(--club-bg)       — 페이지 배경 (기본: line-25 #0B1929)
 *   var(--club-surface)  — 카드 surface (기본: line-50 #0E1F33)
 *   var(--club-text)     — 주 텍스트 (기본: line-900 #FFFFFF)
 *   var(--club-muted)    — 보조 텍스트 (기본: line-500 #7C92AC)
 */
export default async function ClubSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const club = await requirePublicClubBySlug(params.slug);
  const skin = getClubSkin(club.skin_key);

  return (
    <div
      data-club-skin={skin.key}
      style={skin.cssVars as CSSProperties}
    >
      {children}
    </div>
  );
}
