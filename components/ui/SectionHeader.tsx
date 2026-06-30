import Link from "next/link";

/**
 * SectionHeader — ATP 스타일 섹션 제목 + 선택적 CTA 링크.
 *
 * Step 15-5에서 각 페이지마다 직접 작성하던 섹션 h2 패턴을
 * 이 컴포넌트 하나로 통일한다.
 *
 * 패턴:
 *   title    = "font-display text-xs font-bold uppercase tracking-widest text-line-500"
 *   cta link = "text-xs font-bold uppercase text-clay-400" (오른쪽 정렬)
 *
 * 사용 예시:
 *   <SectionHeader title="다음 일정" href="/attendance" cta="더보기" />
 *   <SectionHeader title="최근 경기" href="/matches" cta="전체보기" />
 *   <SectionHeader title="최근 출석" />  ← CTA 없음
 */

interface SectionHeaderProps {
  title: string;
  href?: string;
  cta?: string;
  className?: string;
}

export function SectionHeader({ title, href, cta, className = "" }: SectionHeaderProps) {
  return (
    <div className={`mb-2 flex items-center justify-between ${className}`}>
      <h2 className="font-display text-xs font-bold uppercase tracking-widest text-line-500">
        {title}
      </h2>
      {href && cta && (
        <Link
          href={href}
          className="font-display text-[10px] font-bold uppercase tracking-wider text-clay-400 transition-opacity hover:opacity-70"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}

/**
 * EmptyState — ATP 스타일 빈 상태 표시.
 *
 * 현재 각 페이지마다 직접 작성하던
 * `<Card className="p-6 text-center text-sm text-line-400">메시지</Card>` 패턴을 통일한다.
 *
 * 사용 예시:
 *   <EmptyState message="아직 등록된 경기가 없어요." />
 *   <EmptyState message="검색 결과가 없어요." sub="필터를 바꿔보세요." />
 */

interface EmptyStateProps {
  message: string;
  sub?: string;
  className?: string;
}

export function EmptyState({ message, sub, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-line-200/50 bg-line-100 p-8 text-center shadow-card ${className}`}
    >
      <p className="font-display text-xs font-bold uppercase tracking-widest text-line-500">
        {message}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-line-400">{sub}</p>
      )}
    </div>
  );
}
