import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/members/roles
 * 관리자 목록 조회 — manager/admin/master 권한 회원 반환.
 * 접근: owner/master 전용 (isOwner)
 */
export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.isOwner) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, nickname, permission_role, auth_user_id, is_kakao_linked")
    .in("permission_role", ["manager", "admin", "master"])
    .eq("is_active", true)
    .order("permission_role") // master → admin → manager (enum 순)
    .order("name");

  if (error) {
    return NextResponse.json({ error: "관리자 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // master → admin → manager 순 정렬
  const order: Record<string, number> = { master: 0, admin: 1, manager: 2 };
  const sorted = (data ?? []).sort(
    (a, b) => (order[a.permission_role] ?? 9) - (order[b.permission_role] ?? 9)
  );

  return NextResponse.json({ ok: true, members: sorted });
}
