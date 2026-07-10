import type { ReactNode } from "react";

/**
 * ClubPageHeader — 클럽 내부 페이지(랭킹, 선수 명단, 기록 등)용 표준 헤더.
 *
 * ClubBrandHeader(클럽 홈 브랜드 헤더)와 달리
 * 페이지별 eyebrow 레이블과 제목만 받는 경량 헤더다.
 *
 * text-clay-400은 globals.css의 CSS var 오버라이드로
 * 스킨별 --club-primary 색상으로 자동 전환된다.
 * 이 컴포넌트에서 스킨을 직접 참조할 필요 없다.
 */
interface ClubPageHeaderProps {
  /** 영문 소분류 라벨 ("Ranking", "Club Roster" 등) */
  eyebrow: string;
  /** 한국어 페이지 제목 */
  title: string;
  /** 제목 아래 부제 (선택) */
  subtitle?: string;
  /** eyebrow 앞에 컬러 닷 인디케이터 표시 여부 */
  showDot?: boolean;
  /** 헤더 우측 슬롯 (뒤로가기 링크, 필터 버튼 등) */
  rightSlot?: ReactNode;
  /** 헤더 wrapper className. 기본값: "mb-5" */
  className?: string;
}

export function ClubPageHeader({
  eyebrow,
  title,
  subtitle,
  showDot = false,
  rightSlot,
  className = "mb-5",
}: ClubPageHeaderProps) {
  return (
    <header
      className={
        rightSlot
          ? `${className} flex items-start justify-between`
          : className
      }
    >
      <div>
        {showDot ? (
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-clay-400" />
            <p className="eyebrow-en text-clay-400">{eyebrow}</p>
          </div>
        ) : (
          <p className="eyebrow-en text-clay-400">{eyebrow}</p>
        )}
        <h1 className="headline-kr text-4xl text-line-900">{title}</h1>
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
