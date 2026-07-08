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

/**
 * CurrentClub — getCurrentClub()의 반환 타입. clubs 테이블 컬럼과 1:1 대응.
 */
export type CurrentClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

/**
 * getCurrentClub(): 서버 컴포넌트/API route에서만 호출.
 *
 * getCurrentClubId()와 검증 흐름은 동일하되(쿠키 → clubs 존재+active 확인 →
 * user 확인 → member 소속 확인), clubs 조회 시 name/slug/description까지
 * 함께 가져와 club 객체 전체를 반환한다. 화면에 클럽명이 필요한 소수의
 * 페이지에서만 선택적으로 쓰는 상위 호환 함수다 — 기존 getCurrentClubId()
 * 호출부(수십 곳)는 그대로 두고 건드리지 않는다.
 *
 * 폴백 우선순위:
 *   1) DEFAULT_CLUB_ID로 clubs를 다시 조회해 실제 DB의 기본 클럽 정보를
 *      반환한다(청우회라는 문자열을 코드에 직접 적지 않는다).
 *   2) 그 재조회마저 실패하면(DB 완전 응답 불가 등), 화면이 깨지지 않도록
 *      club-neutral한 최소 fallback 객체를 반환한다 — name은 특정 클럽명이
 *      아니라 "우리 클럽" 같은 중립 문구를 쓴다.
 *
 * 절대 throw하지 않는다. 쿠키를 set/remove하지 않는다.
 */
export async function getCurrentClub(): Promise<CurrentClub> {
  const supabase = createClient();

  async function fetchClubById(clubId: string): Promise<CurrentClub | null> {
    const { data } = await supabase
      .from("clubs")
      .select("id, name, slug, description, status")
      .eq("id", clubId)
      .maybeSingle();
    return data ?? null;
  }

  try {
    const cookieStore = cookies();
    const cookieClubId = cookieStore.get(SELECTED_CLUB_COOKIE)?.value;

    if (cookieClubId) {
      const club = await fetchClubById(cookieClubId);

      if (club && club.status === "active") {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: member } = await supabase
            .from("members")
            .select("id")
            .eq("club_id", cookieClubId)
            .eq("auth_user_id", user.id)
            .eq("is_active", true)
            .eq("is_dormant", false)
            .is("deleted_at", null)
            .maybeSingle();

          if (member) {
            return club;
          }
        }
      }
    }

    // 폴백 1: DEFAULT_CLUB_ID로 clubs를 다시 조회해 실제 DB 값을 반환한다.
    const fallbackClub = await fetchClubById(DEFAULT_CLUB_ID);
    if (fallbackClub) {
      return fallbackClub;
    }

    // 폴백 2: 그마저 실패하면 club-neutral한 최소 fallback을 반환한다.
    return {
      id: DEFAULT_CLUB_ID,
      name: "우리 클럽",
      slug: "",
      description: null,
      status: "active",
    };
  } catch {
    // 어떤 에러가 나도 예외를 밖으로 던지지 않고 안전하게 폴백한다.
    return {
      id: DEFAULT_CLUB_ID,
      name: "우리 클럽",
      slug: "",
      description: null,
      status: "active",
    };
  }
}
