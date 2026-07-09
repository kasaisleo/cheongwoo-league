/**
 * lib/club-display.ts — 클럽 표시용 순수 유틸 함수 모음.
 *
 * ⚠️ 이 파일은 next/headers, Supabase 등 서버 전용 모듈을 절대 import하지
 * 않는다 — 순수 함수만 담아서 서버 컴포넌트와 클라이언트 컴포넌트 양쪽에서
 * 안전하게 import할 수 있게 한다(lib/current-club.ts와 성격이 다름 — 그
 * 파일은 서버 전용이라 클라이언트가 절대 import하면 안 된다).
 */

/**
 * clubs.slug를 영문 eyebrow 라벨로 변환한다.
 * 예: "mapo-cheongwoo" → "MAPO CHEONGWOO CLUB"
 * 예: "namaste" → "NAMASTE CLUB"
 * slug가 비어있으면 club-neutral한 "OUR CLUB"으로 대체한다 — 특정 클럽명을
 * 코드에 직접 적지 않는다.
 */
export function formatClubEyebrow(slug: string | null | undefined): string {
  const normalized = slug?.trim();
  if (!normalized) return "OUR CLUB";

  return `${normalized.replace(/[-_]+/g, " ").toUpperCase()} CLUB`;
}
