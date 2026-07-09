import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * POST /api/admin/unlink-member
 * members.auth_user_id = null + is_kakao_linked = false 처리.
 *
 * 보호 규칙:
 *   - master 계정 연결 해제 금지
 *   - 본인 계정 연결 해제 금지
 *   - 이미 미연결 회원은 400
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const { memberId } = await request.json() as { memberId?: string };
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const clubId = access.clubId ?? "";

  // 대상 member 조회: service role (RLS 우회 — auth_user_id 정확히 읽음)
  const supabaseAdmin = createServiceClient();
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, name, permission_role, auth_user_id")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // master 연결 해제 금지
  if (member.permission_role === "master") {
    return NextResponse.json({ error: "master 계정의 연결은 해제할 수 없습니다." }, { status: 403 });
  }

  // 본인 계정 해제 금지
  if (member.auth_user_id && member.auth_user_id === access.userId) {
    return NextResponse.json({ error: "본인 계정의 연결은 해제할 수 없습니다." }, { status: 403 });
  }

  // 이미 미연결
  if (!member.auth_user_id) {
    return NextResponse.json({ error: "이미 카카오 연결이 해제된 회원입니다." }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ auth_user_id: null, is_kakao_linked: false })
    .eq("id", memberId)
    .eq("club_id", clubId);

  if (updateError) {
    return NextResponse.json({ error: "연결 해제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `${member.name} 계정의 카카오 연결이 해제되었습니다.` });
}
