import { redirect } from "next/navigation";

/**
 * /members/new — 레거시 경로.
 *
 * 이 화면도 /matches/new와 같은 사례다: 이름은 Public이지만 원래부터
 * requireAdminAccess()로 관리자만 접근 가능했고, 실제 진입 링크는 앱 어디에도
 * 없는 고아 라우트였다(canonical은 /admin/members/new?type=member, 이미
 * Admin 대시보드 "회원 등록" 퀵액션에서 실제로 쓰이고 있다). 폼/로직 파일
 * (NewMemberPageClient.tsx)과 전용 API(POST /api/members)는 사용처가 이
 * 라우트뿐임을 확인하고 제거했다 — 이 파일은 기존 북마크·링크 호환을 위해
 * 쿼리스트링을 보존한 채 리다이렉트만 수행한다. type이 없으면 회원 등록
 * 기본값(member)으로 보낸다.
 */
export default function NewMemberPage({
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
  if (!qs.has("type")) qs.set("type", "member");
  redirect(`/admin/members/new?${qs.toString()}`);
}
