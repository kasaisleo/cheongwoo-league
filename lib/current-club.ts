/**
 * currentClubId 서버 전용 로직 (Phase 3A-1, 재설계)
 *
 * ⚠️ 이 파일은 서버 전용이다 (next/headers, lib/supabase/server 사용).
 * "use client" 파일은 이 파일을 절대 import하면 안 된다 — DEFAULT_CLUB_ID만
 * 필요하다면 "@/lib/club-constants"에서 가져온다. (이전 버전은 상수와 서버
 * 로직이 한 파일에 있어서, 클라이언트 파일이 DEFAULT_CLUB_ID를 가져오려다
 * 이 파일 전체를 import하게 되고, 그 결과 next/headers까지 클라이언트 번들
 * 그래프에 걸리는 문제가 있었다. 이번에 상수(club-constants.ts)와 서버 로직
 * (이 파일)을 물리적으로 분리해 해결했다.)
 *
 * getCurrentClubId(): 서버 컴포넌트/API route에서만 호출.
 *   1) selected_club_id 쿠키 없으면 DEFAULT_CLUB_ID 반환
 *   2) 쿠키 있으면 아래를 전부 통과해야 그 값을 반환, 하나라도 실패하면 폴백:
 *      - clubs 테이블에 해당 id 존재 + status = 'active'
 *      - 현재 로그인한 auth user 존재
 *      - members 테이블에 club_id + auth_user_id 조합으로 소속 확인
 *        (is_active=true, is_dormant=false, deleted_at IS NULL인 active member만 인정)
 *   절대 throw하지 않는다 — 모든 에러는 catch에서 DEFAULT_CLUB_ID로 폴백한다
 *   (수십 개 호출부가 이 함수에 의존하므로, 예외를 던지면 앱 전체 장애로
 *   이어질 수 있다).
 *   쿠키를 set/remove하지 않는다 — 읽기(get)만 한다.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CLUB_ID, SELECTED_CLUB_COOKIE } from "@/lib/club-constants";

export async function getCurrentClubId(): Promise<string> {
  try {
    const cookieStore = cookies();
    const cookieClubId = cookieStore.get(SELECTED_CLUB_COOKIE)?.value;

    if (!cookieClubId) {
      return DEFAULT_CLUB_ID;
    }

    const supabase = createClient();

    // 1) clubs 테이블에 해당 id가 존재하고 status가 active인지 확인
    const { data: club } = await supabase
      .from("clubs")
      .select("id, status")
      .eq("id", cookieClubId)
      .maybeSingle();

    if (!club || club.status !== "active") {
      return DEFAULT_CLUB_ID;
    }

    // 2) 현재 로그인한 auth user 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return DEFAULT_CLUB_ID;
    }

    // 3) 그 club의 active member인지 확인
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("club_id", cookieClubId)
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .eq("is_dormant", false)
      .is("deleted_at", null)
      .maybeSingle();

    if (!member) {
      return DEFAULT_CLUB_ID;
    }

    return cookieClubId;
  } catch {
    // 어떤 에러가 나도 예외를 밖으로 던지지 않고 안전하게 폴백한다.
    return DEFAULT_CLUB_ID;
  }
}
