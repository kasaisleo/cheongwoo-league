import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

/**
 * GET /api/admin/guests/search?q=...
 * 게스트 검색 — 활성, 미전환 게스트만.
 * 전화번호는 관리자만 반환.
 */
export async function GET(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ guests: [] });

  const supabase = createClient();
  const { data } = await supabase
    .from("guests")
    .select("id, name, phone")
    .eq("is_active", true)
    .eq("club_id", CHEONGWOO_CLUB_ID)
    .is("converted_to_member_id", null)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);

  return NextResponse.json({ guests: data ?? [] });
}
