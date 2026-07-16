import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * 출석 화면(Public, 로그인 불필요) 명단에 필요한 활동 회원 목록 조회 API.
 *
 * members는 anon/authenticated GRANT가 회수되어(0037) 브라우저에서 직접
 * 조회할 수 없다 — service-role로 조회하되 clubId로 스코프하고, 화면에
 * 실제 필요한 최소 컬럼(id/name/nickname/district/member_type)만 반환한다.
 * 기존 is_active=true, is_dormant=false 필터(탈퇴/휴면 회원 제외 의미)는
 * 그대로 유지한다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await createServiceClient()
    .from("members")
    .select("id, name, nickname, district, member_type")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .eq("is_dormant", false)
    .order("nickname");

  if (error) {
    console.error("[attendance/roster]", error.code, error.message);
    return NextResponse.json({ error: "명단을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
