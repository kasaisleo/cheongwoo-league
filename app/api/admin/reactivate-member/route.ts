import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * POST /api/admin/reactivate-member
 *
 * 비활성화(is_active=false 또는 deleted_at 설정)된 회원을 활동 상태로 되돌린다.
 * members.is_active = true, deleted_at = null 로만 업데이트한다 —
 * 카카오 연결(auth_user_id)·경기·출석·포인트 기록은 건드리지 않는다.
 *
 * 보안:
 *   - request body의 club_id는 절대 신뢰하지 않는다. access.clubId만 사용.
 *   - 대상 member는 반드시 id + club_id로 조회 — 다른 club 소속이면 404.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const clubId = access.clubId;
  if (!clubId) {
    return NextResponse.json({ error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." }, { status: 400 });
  }

  const { memberId } = (await request.json()) as { memberId?: string };
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, name, is_active, deleted_at")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  if (member.is_active && !member.deleted_at) {
    return NextResponse.json({ error: "이미 활동 중인 회원입니다." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("members")
    .update({ is_active: true, deleted_at: null })
    .eq("id", memberId)
    .eq("club_id", clubId);

  if (updateError) {
    return NextResponse.json({ error: "복구에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `${member.name} 님을 활동 상태로 복구했습니다.` });
}
