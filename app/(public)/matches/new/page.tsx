import { redirect } from "next/navigation";

/**
 * /matches/new — 레거시 경로.
 *
 * 이 화면은 애초에 Public 방문자용 기능이 아니었다(원래도 requireAdminAccess()로
 * 관리자만 접근 가능했고, 내부 링크/API가 전부 /admin/* 기준이었다). 실제 폼/로직은
 * app/admin/matches/new로 이전했다 — 이 파일은 기존 북마크·링크 호환을 위해
 * 쿼리스트링을 보존한 채 리다이렉트만 수행한다. club 확정·인증은 여기서 하지 않고
 * /admin/matches/new(및 그 상위 admin/matches/layout.tsx의 requireAdminAccess())가
 * 전담한다.
 */
export default function NewMatchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else if (value !== undefined) {
      qs.append(key, value);
    }
  }
  const query = qs.toString();
  redirect(query ? `/admin/matches/new?${query}` : "/admin/matches/new");
}
