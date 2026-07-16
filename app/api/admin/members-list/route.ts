import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/members-list
 *
 * members_select_all 정책 삭제에 대비해, Admin 화면들이 회원 드롭다운/목록을
 * 채우려고 브라우저에서 직접 anon-key Supabase 조회를 하던 것을 대체하는
 * 공용 엔드포인트. service-role + access.clubId로만 스코프한다 — club_id를
 * 쿼리 파라미터로 받지 않는다(신뢰 금지).
 *
 * Query:
 *   dormant=exclude  → is_dormant=false 추가 필터 (기본은 필터 없음, 휴면 포함)
 *   unlinked=true     → auth_user_id is null 추가 필터(회원 연결 화면 전용)
 *
 * 반환 컬럼은 화면 표시에 필요한 최소 집합만 — phone/address_full/age/memo/
 * permission_role/auth_user_id/kakao_provider_id/deleted_at/created_at은
 * 포함하지 않는다(그 값들이 필요한 화면은 /admin/members/[id] 전용 경로를 쓴다).
 * district는 동명이인 구분(getDisambiguatedName)에 필요해 포함한다.
 */
export async function GET(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const excludeDormant = searchParams.get("dormant") === "exclude";
  const unlinkedOnly = searchParams.get("unlinked") === "true";

  const supabase = createServiceClient();
  let query = supabase
    .from("members")
    .select("id, name, nickname, district, member_type, role, mapo_score, league_point, wins, losses, is_active, is_dormant")
    .eq("club_id", access.clubId)
    .eq("is_active", true)
    .order("nickname", { ascending: true });

  if (excludeDormant) query = query.eq("is_dormant", false);
  if (unlinkedOnly) query = query.is("auth_user_id", null);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "회원 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
