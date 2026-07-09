import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { PermissionRole } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/update-member-role
 * permission_role 변경.
 *
 * 지정: member/scorer → manager 또는 admin
 * 해제: manager/admin → member
 *
 * 보호 규칙:
 *   - master 지정 금지 (promote-owner API 전용)
 *   - master 해제 금지
 *   - 본인 권한 변경 금지
 */
const ASSIGNABLE_ROLES: PermissionRole[] = ["manager", "admin"];
const DEMOTABLE_ROLES: PermissionRole[] = ["manager", "admin"];

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const { memberId, newRole } = await request.json() as {
    memberId?: string;
    newRole?: string;
  };

  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }
  if (!newRole) {
    return NextResponse.json({ error: "newRole이 필요합니다." }, { status: 400 });
  }

  // 허용 역할 검증
  const allowedRoles: string[] = [...ASSIGNABLE_ROLES, "member"];
  if (!allowedRoles.includes(newRole)) {
    return NextResponse.json(
      { error: `허용되지 않는 역할입니다. (${allowedRoles.join(", ")} 중 선택)` },
      { status: 400 }
    );
  }

  const supabaseAdmin = createServiceClient();
  const clubId = access.clubId ?? "";

  // 대상 member 조회: service role (RLS 우회 — auth_user_id 정확히 읽음)
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, name, permission_role, auth_user_id")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // master 해제/변경 금지
  if (member.permission_role === "master") {
    return NextResponse.json({ error: "master 권한은 변경할 수 없습니다." }, { status: 403 });
  }

  // 본인 권한 변경 금지
  if (member.auth_user_id && member.auth_user_id === access.userId) {
    return NextResponse.json({ error: "본인 권한은 변경할 수 없습니다." }, { status: 403 });
  }

  // 이미 동일 역할
  if (member.permission_role === newRole) {
    return NextResponse.json(
      { error: `이미 ${newRole} 역할입니다.` },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ permission_role: newRole as PermissionRole })
    .eq("id", memberId)
    .eq("club_id", clubId);

  if (updateError) {
    return NextResponse.json({ error: "권한 변경에 실패했습니다." }, { status: 500 });
  }

  const action = (ASSIGNABLE_ROLES as string[]).includes(newRole) ? "지정" : "해제";
  return NextResponse.json({
    ok: true,
    message: `${member.name}의 권한이 ${newRole}로 변경되었습니다. (${action})`,
  });
}
