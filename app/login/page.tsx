import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginPageClient from "./LoginPageClient";

/**
 * /login — 서버 wrapper.
 *
 * returnUrl 지원:
 *   /login?returnUrl=/mypage → 로그인 성공 후 /mypage 복귀
 *   returnUrl은 /auth/callback의 redirectTo state로 전달됨.
 *
 * 보안: returnUrl은 같은 origin 내부 경로만 허용 (외부 URL redirect 방지).
 *
 * 이미 로그인된 사용자는 서버에서 바로 returnUrl(또는 "/")로 리다이렉트한다
 * (QA-P1-D) — 이전에는 클라이언트에서 세션을 확인한 뒤 리다이렉트하느라
 * "확인 중..." 화면이 항상 한 번 보였는데, 이 확인 자체를 서버로 옮겨서
 * 없앤다. 로그인되지 않은 경우에만 클라이언트 로그인 폼(LoginPageClient)을
 * 렌더링한다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string };
}) {
  const returnUrl = searchParams?.returnUrl ?? "";
  // 같은 origin 내부 경로만 허용 — 절대 URL이나 외부 도메인 차단
  const safeReturn = returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(safeReturn);

  return <LoginPageClient returnUrl={safeReturn} />;
}
