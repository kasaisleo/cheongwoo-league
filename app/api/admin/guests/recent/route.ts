import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/guests/recent
 * 최근 등록 게스트 10명 (활성, 미전환).
 */
export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { data, error } = await createServiceClient()
    .from("guests")
    .select("id, name, phone, years_playing")
    .eq("is_active", true)
    .eq("club_id", access.clubId)
    .is("converted_to_member_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[admin/guests/recent]", error.code, error.message);
    return NextResponse.json({ error: "게스트 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ guests: data ?? [] });
}
