import type { ReactNode } from "react";
import { formatClubEyebrow } from "@/lib/club-display";
import type { ClubSkin } from "@/lib/club-skin";

/**
 * ClubBrandHeader — 클럽 홈/대표 페이지용 브랜드 헤더.
 *
 * skin.logos 존재 여부로 렌더 방식을 결정한다:
 *   - logos 있음: 클럽 로고 이미지 표시
 *   - logos 없음: 컬러 닷 + 영문 eyebrow 텍스트 표시
 *
 * 새 스킨 추가 시 이 컴포넌트를 수정할 필요 없다.
 * lib/club-skin.ts의 SKINS 항목과 logos 존재 여부만 설정하면 된다.
 */
interface ClubBrandHeaderProps {
  club: { name: string; slug: string };
  skin: ClubSkin;
  /** 페이지 제목. 기본값: `${club.name} 리그` */
  title?: string;
  /** 제목 아래 부제. undefined이면 미표시. */
  subtitle?: string;
  /** 오른쪽 슬롯 (뒤로가기 링크, 액션 버튼 등) */
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

  return (
    <header className={rightSlot ? `${className} flex items-start justify-between` : className}>
      <div>
        {skin.logos ? (
          <div className="mb-3">
            <img
              src={skin.logos.primary}
              alt={club.name}
              className="club-brand-logo"
              width={104}
              height={104}
            />
          </div>
        ) : (
          <div className="mb-1.5 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-clay-400" />
            <p className="eyebrow-en text-clay-400">{formatClubEyebrow(club.slug)}</p>
          </div>
        )}
        <h1 className="headline-kr text-4xl text-line-900">{pageTitle}</h1>
        {subtitle && (
          <p className="mt-1 max-w-[240px] break-keep text-xs leading-relaxed text-line-500">
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot}
    </header>
  );
}
