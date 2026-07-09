import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/guests/recent
 * 최근 등록 게스트 10명 (활성, 미전환).
 */
export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("guests")
    .select("id, name, phone, years_playing")
    .eq("is_active", true)
    .eq("club_id", access.clubId ?? "")
    .is("converted_to_member_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ guests: data ?? [] });
}
