import type { ReactNode } from "react";
import { formatClubEyebrow } from "@/lib/club-display";
import type { ClubSkin } from "@/lib/club-skin";

/**
 * ClubBrandHeader — 클럽 홈/대표 페이지용 브랜드 헤더.
 *
 * anatomy:
 *   <header>
 *     <content>  eyebrow · title · subtitle  (항상 좌측, flex-1)
 *     <side>     rightSlot · logo            (optional, 우측)
 *   </header>
 *
 * - eyebrow/title/subtitle 구조는 모든 스킨에서 동일.
 * - logo는 side slot의 optional brand asset. eyebrow 대체가 아님.
 * - rightSlot과 logo는 동시에 렌더 가능 (수직 적층).
 * - logo 없는 스킨은 logo DOM 미렌더. 빈 공간 유지 안 함.
 * - 320px: content가 min-w-0 flex-1로 압축, side는 flex-shrink-0.
 */
interface ClubBrandHeaderProps {
  club: { name: string; slug: string };
  skin: ClubSkin;
  /** 페이지 제목. 기본값: `${club.name} 리그` */
  title?: string;
  /** 제목 아래 부제. undefined이면 미표시. */
  subtitle?: string;
  /** side slot 상단 (액션 버튼, 뒤로가기 링크 등). logo와 동시 표시 가능. */
  rightSlot?: ReactNode;
  /** 헤더 wrapper className. 기본값: "mb-6" */
  className?: string;
}

export function ClubBrandHeader({
  club,
  skin,
  title,
  subtitle,
  rightSlot,
  className = "mb-6",
}: ClubBrandHeaderProps) {
  const pageTitle = title ?? `${club.name} 리그`;
  const hasSide = !!(rightSlot || skin.logos);

  return (
    <header className={`${className} flex items-start gap-3`}>
      {/* content slot — 항상 좌측, 가용 공간 소유 */}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-clay-400" />
          <p className="eyebrow-en text-clay-400">{formatClubEyebrow(club.slug)}</p>
        </div>
        <h1 className="headline-kr text-4xl text-line-900">{pageTitle}</h1>
        {subtitle && (
          <p className="mt-1 max-w-[240px] break-keep text-xs leading-relaxed text-line-500">
            {subtitle}
          </p>
        )}
      </div>

      {/* side slot — rightSlot + logo 동시 렌더 가능 */}
      {hasSide && (
        <div className="flex flex-shrink-0 flex-col items-end gap-2 pt-1.5">
          {rightSlot}
          {skin.logos && (
            <img
              src={skin.logos.primary}
              alt={club.name}
              className="club-brand-logo"
              width={104}
              height={104}
            />
          )}
        </div>
      )}
    </header>
  );
}
