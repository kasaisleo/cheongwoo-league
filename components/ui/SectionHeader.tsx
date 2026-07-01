import Link from "next/link";

/**
 * SectionHeader — 섹션 타이틀 + 선택적 CTA 링크.
 *
 * 폰트 정책:
 *   한글 타이틀("다음 일정", "최근 경기" 등) → section-title-kr (Noto Sans KR)
 *   CTA("전체보기") → section-title-kr (Noto Sans KR)
 *   Oswald(font-display) 사용 금지 — 회원이 읽는 정보 텍스트.
 */

interface SectionHeaderProps {
  title: string;
  href?: string;
  cta?: string;
  className?: string;
}

export function SectionHeader({ title, href, cta, className = "" }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h2 className="section-title-kr text-line-500">
        {title}
      </h2>
      {href && cta && (
        <Link
          href={href}
          className="section-title-kr text-[11px] text-clay-400 transition-opacity hover:opacity-70"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

/**
 * AttendanceSessionSectionHeader — 출석 세션 섹션 헤더 (SectionHeader 변형).
 * 세션 날짜/타이틀을 같은 스타일로 표시.
 */
interface AttendanceSessionSectionHeaderProps {
  title: string;
  sessionDate?: string;
  className?: string;
}

export function AttendanceSessionSectionHeader({
  title,
  sessionDate,
  className = "",
}: AttendanceSessionSectionHeaderProps) {
  return (
    <div className={`mb-2 flex items-center justify-between ${className}`}>
      <p className="section-title-kr text-line-500">
        {title}
      </p>
      {sessionDate && (
        <span className="text-[11px] text-line-400">{sessionDate}</span>
      )}
    </div>
  );
}

/**
 * EmptyState — 데이터 없음 안내 UI.
 */
interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className = "" }: EmptyStateProps) {
  return (
    <div className={`rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center ${className}`}>
      <p className="text-sm text-line-500">{message}</p>
    </div>
  );
}
