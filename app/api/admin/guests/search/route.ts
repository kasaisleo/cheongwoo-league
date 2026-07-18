import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/guests/search?q=...
 * 게스트 검색 — 활성, 미전환 게스트만.
 * 전화번호는 관리자만 반환.
 */
export async function GET(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ guests: [] });

  const { data, error } = await createServiceClient()
    .from("guests")
    .select("id, name, phone")
    .eq("is_active", true)
    .eq("club_id", access.clubId)
    .is("converted_to_member_id", null)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);

  if (error) {
    console.error("[admin/guests/search]", error.code, error.message);
    return NextResponse.json({ error: "검색에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ guests: data ?? [] });
}
