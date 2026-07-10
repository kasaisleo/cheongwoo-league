import type { CSSProperties, ReactNode } from "react";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { getClubSkin } from "@/lib/club-skin";

/**
 * /c/[slug] 공개 클럽 페이지 공통 레이아웃.
 *
 * 역할:
 *  - clubs.skin_key → ClubSkin 해석
 *  - [data-club-skin] wrapper에 CSS 변수 주입 (공개 페이지 컴포넌트 스킨 적용)
 *  - globals.css의 :root:has([data-club-skin="namaste"]) 셀렉터와 연동 →
 *    BottomTabBar 등 wrapper 밖 글로벌 컴포넌트에도 스킨 변수 전파
 *  - 로고가 있는 스킨: 옅은 워터마크 배경 표시 (pointer-events none, z-index 1)
 *
 * 워터마크 stacking:
 *  - position: fixed; z-index: 1 → 일반 콘텐츠(no z-index) 위
 *  - opacity: 0.03~0.04 → 텍스트 가독성 영향 없음
 *  - BottomTabBar(z-40), cw-loader-overlay(z-9999) 는 z-index 상 워터마크 위
 *
 * requirePublicClubBySlug는 React cache()로 래핑되어 있으므로
 * 하위 page.tsx에서 재호출해도 DB 쿼리는 추가 발생하지 않는다.
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
    <>
      {/* 워터마크 — 로고가 있는 스킨에만 표시 */}
      {skin.logos && (
        <div aria-hidden="true" className="club-watermark-container">
          <img
            src={skin.logos.primary}
            alt=""
            className="club-watermark-img"
          />
        </div>
      )}

      {/* 스킨 wrapper — CSS 변수 주입 + [data-club-skin] 셀렉터 기준점 */}
      <div
        data-club-skin={skin.key}
        style={skin.cssVars as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
