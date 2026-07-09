import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/members/roles
 * 관리자 목록 조회 — manager/admin/master 권한 회원 반환.
 *
 * - 권한 확인: getAdminAccessServer().isOwner (owner/master 전용)
 * - DB 조회: createServiceClient() — RLS 우회, auth_user_id 안전 조회
 * - 응답: auth_user_id 전체값 미노출, is_kakao_connected boolean으로 가공
 */
export async function GET() {
  // 1. 권한 확인 (anon client)
  const access = await getAdminAccessServer();
  if (!access.isOwner) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  // 2. DB 조회 — service role (RLS 우회, auth_user_id 정확히 읽음)
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, nickname, permission_role, auth_user_id")
    .in("permission_role", ["manager", "admin", "master"])
    .eq("is_active", true)
    .eq("club_id", access.clubId ?? "")
    .order("name");

  if (error) {
    return NextResponse.json({ error: "관리자 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // 3. master → admin → manager 순 정렬
  const order: Record<string, number> = { master: 0, admin: 1, manager: 2 };
  const sorted = (data ?? []).sort(
    (a, b) => (order[a.permission_role] ?? 9) - (order[b.permission_role] ?? 9)
  );

  // 4. auth_user_id 미노출 — boolean + 앞 8자 마스킹만 전달
  const members = sorted.map((m) => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    permission_role: m.permission_role,
    is_kakao_connected: Boolean(m.auth_user_id),
    // 본인 계정 표시용 (풀 UUID 미노출)
    auth_user_id_prefix: m.auth_user_id ? `${m.auth_user_id.slice(0, 8)}…` : null,
  }));

  return NextResponse.json({ ok: true, members });
}
