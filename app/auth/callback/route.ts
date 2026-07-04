import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SELECTED_CLUB_COOKIE } from "@/lib/club-constants";

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
 *   2. authUser.id 기준으로 members 전체 후보 조회 (club_id로 미리 좁히지 않음)
 *      — active member 기준: is_active=true, is_dormant=false, deleted_at IS NULL
 *   3. 후보들의 club_id 목록으로 clubs를 조회해 status='active'인 것만 최종 소속으로 인정
 *   4. active club 0개   → selected_club_id 쿠키 삭제, "/auth/pending"
 *   5. active club 1개   → 그 club_id로 selected_club_id 쿠키 세팅, returnUrl or "/"
 *   6. active club 2개+  → 쿠키를 새로 세팅하지 않음(기존 값 유지 또는 미설정 상태 유지),
 *                          returnUrl or "/" (클럽 선택 UI는 아직 없음)
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

  // 2) club_id로 미리 좁히지 않고, 이 auth_user_id의 active member 후보를 전부 조회
  const { data: memberCandidates } = await supabaseAdmin
    .from("members")
    .select("club_id")
    .eq("auth_user_id", authUser.id)
    .eq("is_active", true)
    .eq("is_dormant", false)
    .is("deleted_at", null);

  const candidateClubIds = Array.from(
    new Set(
      (memberCandidates ?? [])
        .map((m) => m.club_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  // 3) 후보 club_id 중 clubs.status = 'active'인 것만 최종 소속으로 인정
  let activeClubIds: string[] = [];
  if (candidateClubIds.length > 0) {
    const { data: activeClubs } = await supabaseAdmin
      .from("clubs")
      .select("id")
      .in("id", candidateClubIds)
      .eq("status", "active");
    activeClubIds = (activeClubs ?? []).map((c) => c.id);
  }

  // 4) active club 0개 → 미연결. 쿠키를 삭제하고 대기 페이지로.
  if (activeClubIds.length === 0) {
    const response = NextResponse.redirect(new URL("/auth/pending", requestUrl.origin));
    response.cookies.delete(SELECTED_CLUB_COOKIE);
    return response;
  }

  // 5) active club 1개 → 그 club_id로 쿠키 세팅 (선택의 모호함이 없음)
  if (activeClubIds.length === 1) {
    const response = NextResponse.redirect(new URL(returnUrl, requestUrl.origin));
    response.cookies.set(SELECTED_CLUB_COOKIE, activeClubIds[0], {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  // 6) active club 2개 이상 → 클럽 선택 UI가 아직 없으므로 쿠키를 새로 세팅하지 않는다.
  //    기존 쿠키가 activeClubIds 안에 있으면 그대로 유지되고(아무 것도 안 건드리므로),
  //    없거나 목록 밖이어도 마찬가지로 아무 것도 하지 않는다 — 두 경우 모두 동작이 같다.
  return NextResponse.redirect(new URL(returnUrl, requestUrl.origin));
}
