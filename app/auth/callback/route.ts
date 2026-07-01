import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * 카카오 OAuth 콜백.
 *
 * returnUrl 지원 (버그픽스):
 *   /login?returnUrl=/mypage → signInWithOAuth redirectTo에 포함 →
 *   이 콜백 URL에 ?returnUrl=/mypage 로 도달 → 로그인 성공 시 해당 경로로 복귀.
 *
 *   보안: returnUrl은 같은 origin 내부 경로만 허용.
 *
 * 처리 순서:
 *   1. code → 세션 교환
 *   2. members.auth_user_id 연결 확인
 *   3. 연결됨   → returnUrl or "/"
 *   4. 미연결   → "/auth/pending"
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // returnUrl 추출 + 보안 검증 (내부 경로만)
  const rawReturn = requestUrl.searchParams.get("returnUrl") ?? "";
  const returnUrl =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//")
      ? rawReturn
      : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const supabase = createClient();
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData.session) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const authUser = exchangeData.session.user;
  const supabaseAdmin = createServiceClient();

  const { data: existingLinkedMember } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (existingLinkedMember) {
    // 연결됨 → returnUrl 또는 홈
    return NextResponse.redirect(new URL(returnUrl, requestUrl.origin));
  }

  // 미연결 → 대기 페이지 (returnUrl 무시 — 아직 회원이 아님)
  return NextResponse.redirect(new URL("/auth/pending", requestUrl.origin));
}
