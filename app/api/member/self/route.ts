import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * 로그인한 사용자가 이 클럽에 연결된 회원인지 확인하는 API.
 * "내 출석 신청" 영역 표시 여부(AttendancePageClient)에 사용한다.
 *
 * members는 anon/authenticated GRANT가 회수되어(0037) 브라우저에서 직접
 * 조회할 수 없다 — auth.getUser()로 검증된 user.id + clubId 조합으로만 조회한다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ memberId: null });
  }

  const { data: member, error } = await createServiceClient()
    .from("members")
    .select("id")
    .eq("club_id", clubId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[member/self]", error.code, error.message);
    return NextResponse.json({ memberId: null });
  }

  return NextResponse.json({ memberId: member?.id ?? null });
}
