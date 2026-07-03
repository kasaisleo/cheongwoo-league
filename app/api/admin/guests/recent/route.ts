import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

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
    .eq("club_id", CHEONGWOO_CLUB_ID)
    .is("converted_to_member_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ guests: data ?? [] });
}
