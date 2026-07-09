import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * staging_members 전체를 조회한다. imported 상태도 포함해서 보여준다(이미 반영된 것 구분용).
 * 권한(Step 8-3): owner 전용 — 일괄 임포트 플로우의 일부.
 */
export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json(
      { error: "이 작업은 owner만 가능합니다." },
      { status: 403 }
    );
  }

  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json({ error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("staging_members")
    .select("*")
    .eq("club_id", currentClubId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
