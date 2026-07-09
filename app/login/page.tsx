import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClub } from "@/lib/current-club";
import LoginPageClient from "./LoginPageClient";

/**
 * /login — 서버 wrapper.
 *
 * returnUrl 지원:
 *   /login?returnUrl=/c/namaste/matches → 로그인 성공 후 /c/namaste/matches 복귀
 *   returnUrl은 /auth/callback의 redirectTo state로 전달됨.
 *
 * 보안: returnUrl은 같은 origin 내부 경로만 허용 (외부 URL redirect 방지).
 *
 * currentClubSlug:
 *   returnUrl이 /c/[slug]/... 형태면 slug를 추출해 로그인 화면 eyebrow에 표시.
 *   그 외에는 getCurrentClub()으로 현재 클럽 slug를 가져온다.
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

  // returnUrl에서 /c/[slug] slug 추출 — context에 맞는 클럽명 표시용
  const slugFromReturn = safeReturn.match(/^\/c\/([^/]+)/)?.[1] ?? null;
  let currentClubSlug: string;
  if (slugFromReturn) {
    currentClubSlug = slugFromReturn;
  } else {
    const currentClub = await getCurrentClub();
    currentClubSlug = currentClub.slug;
  }

  return <LoginPageClient returnUrl={safeReturn} currentClubSlug={currentClubSlug} />;
}
