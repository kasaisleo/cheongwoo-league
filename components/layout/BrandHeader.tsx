import { PlatformHomeLink } from "@/components/navigation/PlatformHomeLink";

/**
 * BrandHeader — 플랫폼 wordmark.
 *
 * 소형(9px), 중립적(opacity-50), skin-aware(var(--club-primary)).
 * 나마스테에서 퍼플, 청우회에서 라임, 기본은 :root의 --club-primary 값.
 * 클럽명/로고는 ClubBrandHeader(공개 홈)에서 별도 표시.
 *
 * PlatformHomeLink: 클릭 즉시 platform transition overlay 표시.
 * 이전 club DOM 잔류 구간 차단.
 */
export function BrandHeader() {
  return (
    <header className="mx-auto max-w-md px-5 pt-3 pb-1">
      <PlatformHomeLink>
        <span
          className="eyebrow-en text-[9px] opacity-50 transition-opacity hover:opacity-80"
          style={{ color: "var(--club-primary)" }}
        >
          SUPER MATCH
        </span>
      </PlatformHomeLink>
    </header>
  );
}
