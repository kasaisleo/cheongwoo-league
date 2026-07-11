import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginPageClient from "./LoginPageClient";
import LoginClubSelectPrompt from "./LoginClubSelectPrompt";

/**
 * /login — 서버 wrapper.
 *
 * returnUrl 지원:
 *   /login?returnUrl=/c/namaste/matches → 로그인 성공 후 /c/namaste/matches 복귀
 *   returnUrl은 /auth/callback의 redirectTo state로 전달됨.
 *
 * 보안: returnUrl은 같은 origin 내부 경로만 허용 (외부 URL redirect 방지).
 *
 * club context: returnUrl의 /c/[slug] 패턴에서만 얻는다.
 *   selected_club_id 쿠키나 DEFAULT_CLUB_ID로 클럽을 추정하지 않는다 —
 *   그 상태로 OAuth를 시작하면 사용자가 의도하지 않은 클럽에 로그인/연결될
 *   위험이 있다(Public Login Slugless Route Final Check).
 *   slug가 없으면 LoginClubSelectPrompt로 클럽 선택을 안내하고 여기서
 *   OAuth를 시작하지 않는다.
 *
 * 이미 로그인된 사용자는 서버에서 바로 returnUrl(또는 "/")로 리다이렉트한다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string };
}) {
  const returnUrl = searchParams?.returnUrl ?? "";
  const safeReturn = returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(safeReturn);

  const slugFromReturn = safeReturn.match(/^\/c\/([^/]+)/)?.[1] ?? null;
  if (!slugFromReturn) {
    return <LoginClubSelectPrompt />;
  }

  return <LoginPageClient returnUrl={safeReturn} currentClubSlug={slugFromReturn} />;
}
