import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * 매치 히스토리 상세(참석자별 기록)에 필요한 회원 이름/구분 조회 API.
 * members는 anon/authenticated GRANT가 회수되어(0037) 브라우저에서 직접
 * 조회할 수 없다 — service-role로 조회하되 clubId로 재검증해 다른 클럽
 * 회원이 섞이지 않게 한다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  const idsParam = request.nextUrl.searchParams.get("ids");

  if (!clubId || !idsParam) {
    return NextResponse.json({ error: "clubId와 ids가 필요합니다." }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("members")
    .select("id, name, member_type")
    .in("id", ids)
    .eq("club_id", clubId);

  if (error) {
    console.error("[matches/session-members]", error.code, error.message);
    return NextResponse.json({ error: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
