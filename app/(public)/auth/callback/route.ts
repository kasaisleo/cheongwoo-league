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
 *      + intended club context를 pending_link_requests에 기록 (이미 연결된 경우 skip)
 *   5. active club 1개   → 그 club_id로 selected_club_id 쿠키 세팅, returnUrl or "/"
 *   6. active club 2개+  → 쿠키를 새로 세팅하지 않음(기존 값 유지 또는 미설정 상태 유지),
 *                          returnUrl or "/" (클럽 선택 UI는 아직 없음)
 *
 * 보안 — pending_link_requests 정책:
 *   - intended club: returnUrl의 /c/{slug} 패턴에서 우선 추출.
 *     returnUrl에 슬러그가 없으면 selected_club_id 쿠키를 레거시 fallback으로 사용.
 *     → 오래된 selected_club_id=cheongwoo 쿠키가 namaste 로그인에 오염되지 않음.
 *   - auth_user_id가 이미 intendedClub members에 존재하면 pending 생성 skip.
 *   - display_name만 저장 (이메일·identities 저장 금지)
 *   - service_role로 INSERT, RLS 공개 policy 없음
 */

/** returnUrl(/c/{slug}/...) 에서 클럽 슬러그 추출. 없으면 null. */
function extractClubSlugFromPath(path: string): string | null {
  const match = path.match(/^\/c\/([^/?#]+)/);
  return match?.[1] ?? null;
}

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
    // intended club 결정:
    //   우선순위 1) returnUrl의 /c/{slug} 패턴 (현재 방문 클럽이 URL에 명시됨)
    //   우선순위 2) selected_club_id 쿠키 (레거시 fallback — stale일 수 있음)
    let intendedClub: { id: string } | null = null;

    const slugFromUrl = extractClubSlugFromPath(returnUrl);
    if (slugFromUrl) {
      const { data } = await supabaseAdmin
        .from("clubs")
        .select("id")
        .eq("slug", slugFromUrl)
        .eq("status", "active")
        .maybeSingle();
      intendedClub = data ?? null;
    }

    if (!intendedClub) {
      // 레거시 fallback: selected_club_id 쿠키 (club_id UUID)
      const cookieClubId = request.cookies.get(SELECTED_CLUB_COOKIE)?.value ?? null;
      if (cookieClubId) {
        const { data } = await supabaseAdmin
          .from("clubs")
          .select("id")
          .eq("id", cookieClubId)
          .eq("status", "active")
          .maybeSingle();
        intendedClub = data ?? null;
      }
    }

    if (intendedClub) {
      // 이미 이 클럽 member로 연결된 경우 pending 생성 skip (동일 auth_user_id 재연결 방지)
      const { data: existingMember } = await supabaseAdmin
        .from("members")
        .select("id")
        .eq("auth_user_id", authUser.id)
        .eq("club_id", intendedClub.id)
        .maybeSingle();

      if (!existingMember) {
        // 표시명 추출 (이메일 저장 금지)
        const displayName =
          (authUser.user_metadata?.name as string | undefined) ??
          (authUser.user_metadata?.full_name as string | undefined) ??
          (authUser.user_metadata?.preferred_username as string | undefined) ??
          (authUser.user_metadata?.user_name as string | undefined) ??
          null;

        // ON CONFLICT (auth_user_id, club_id) → updated_at 갱신 (재로그인 시 staleness 초기화)
        await supabaseAdmin
          .from("pending_link_requests")
          .upsert(
            {
              auth_user_id: authUser.id,
              club_id: intendedClub.id,
              display_name: displayName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "auth_user_id,club_id", ignoreDuplicates: false }
          );
      }
    }

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
  return NextResponse.redirect(new URL(returnUrl, requestUrl.origin));
}
