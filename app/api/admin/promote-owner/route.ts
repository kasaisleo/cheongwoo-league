import { NextResponse } from "next/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/promote-owner
 *
 * 현재 카카오 로그인 사용자의 permission_role을 "master"로 승격.
 *
 * 실행 조건 (모두 충족해야 함):
 *   1. kakaoIsOwner = true (현재 club 기준 카카오 permission_role이 master)
 *      — cw_admin_session(cookie)만으로는 더 이상 통과하지 않음 (Phase 3C-2C)
 *   2. 카카오 세션 존재
 *   3. 해당 auth.user.id와 연결된 members 레코드 존재
 *
 * 보호 파일(lib/admin-auth.ts, lib/admin-permissions.ts, middleware.ts)은 수정하지 않음.
 */
export async function POST() {
  // 1. kakaoIsOwner 확인 (cw_admin_session은 더 이상 owner 권한으로 인정하지 않음)
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json(
      { error: "Owner 세션이 필요합니다." },
      { status: 403 }
    );
  }

  // 2. 카카오 세션 확인
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: "카카오 로그인 세션이 없습니다. 먼저 카카오로 로그인해주세요." },
      { status: 401 }
    );
  }

  const authUserId = session.user.id;
  const clubId = access.clubId ?? "";

  // 3. 연결된 members 레코드 확인 (service-role로 RLS 우회)
  const supabaseAdmin = createServiceClient();
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, permission_role, name")
    .eq("auth_user_id", authUserId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json(
      { error: "카카오 계정과 연결된 회원 정보가 없습니다. 먼저 회원 연결을 완료해주세요." },
      { status: 404 }
    );
  }

  // 이미 master인 경우
  if (member.permission_role === "master") {
    return NextResponse.json(
      { alreadyMaster: true, message: "이미 Owner 계정으로 연결되어 있습니다." },
      { status: 200 }
    );
  }

  // 4. permission_role → "master" 업데이트
  const { error: updateError } = await supabaseAdmin
    .from("members")
    .update({ permission_role: "master" })
    .eq("id", member.id)
    .eq("club_id", clubId);

  if (updateError) {
    return NextResponse.json(
      { error: "권한 업데이트에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${member.name} 계정이 Owner 권한으로 연결되었습니다.`,
    memberId: member.id,
  });
}
