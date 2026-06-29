import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * 카카오 OAuth 콜백. /login의 signInWithOAuth가 카카오 동의 화면을 거쳐
 * 돌아오는 지점이다.
 *
 * 처리 순서(Step 10-1, 전화번호 자동 매칭 없는 버전):
 *   1. URL의 code를 Supabase Auth 세션으로 교환(쿠키에 세션 저장)
 *   2. 로그인한 auth.users 사용자 정보 조회
 *   3. members.auth_user_id가 이미 이 사용자로 연결되어 있으면 → "/" (로그인 완료)
 *   4. 연결되어 있지 않으면 → "/auth/pending" (운영진 수동 연결 대기)
 *
 * 전화번호 기반 자동 매칭은 이번 Step에서 의도적으로 구현하지 않는다 — 카카오
 * 앱이 아직 전화번호 권한을 사용할 수 없는 상태(개인정보 권한 심사/비즈니스
 * 인증 이슈)이고, 청우회 규모에서는 운영진 수동 연결이 더 단순하고 안정적이라고
 * 판단했다(Step 10 설계 결정). 수동 연결 UI는 후속 Step(10-2)에서 다룬다.
 *
 * 이 route는 관리자 인증(lib/admin-auth.ts)을 전혀 참조하지 않는다 — 회원
 * 인증과 관리자 인증은 분리된 별개의 시스템이다.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    // 카카오 동의를 취소했거나 비정상 접근 — 로그인 페이지로 돌려보낸다.
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const supabase = createClient();
  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData.session) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const authUser = exchangeData.session.user;

  // service-role로 members를 조회한다 — RLS로 anon에게 members 쓰기를
  // 열어두지 않는 기존 정책(app/api/members/route.ts 등)과 동일한 이유다.
  const supabaseAdmin = createServiceClient();

  const { data: existingLinkedMember } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (existingLinkedMember) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  // 연결된 회원이 없음 — 운영진 수동 연결을 기다린다.
  return NextResponse.redirect(new URL("/auth/pending", requestUrl.origin));
}
