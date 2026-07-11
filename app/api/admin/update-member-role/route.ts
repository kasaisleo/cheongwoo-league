import { NextRequest, NextResponse } from "next/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { assignMemberPermissionRole } from "@/lib/club-admin-audit-log";
import type { PermissionRole } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/update-member-role
 * permission_role 변경. 실제 mutation + audit insert는 assign_member_permission_role
 * RPC(DB 함수)가 단일 트랜잭션으로 처리한다 — 이 route는 인증 확인, 입력 검증,
 * RPC 호출, 에러 매핑만 담당한다.
 *
 * 허용 역할: member, manager, admin. master/scorer 요청은 400.
 * 보호 규칙(actor 재검증 포함 전부 RPC 내부에서 재확인됨):
 *   - master 대상/지정 금지, 본인 권한 변경 금지
 *   - 휴면·탈퇴·활동 제외·카카오 미연결 대상 금지
 *   - cross-club 접근은 club_id scope로 member_not_found(404) 처리
 */
const ALLOWED_ROLES: PermissionRole[] = ["member", "manager", "admin"];

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner || !access.clubId || !access.userId) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const { memberId, newRole } = await request.json() as {
    memberId?: string;
    newRole?: string;
  };

  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }
  if (!newRole || !(ALLOWED_ROLES as string[]).includes(newRole)) {
    return NextResponse.json(
      { error: `허용되지 않는 역할입니다. (${ALLOWED_ROLES.join(", ")} 중 선택)` },
      { status: 400 }
    );
  }

  const result = await assignMemberPermissionRole({
    clubId: access.clubId,
    actorAuthUserId: access.userId,
    targetMemberId: memberId,
    newRole: newRole as PermissionRole,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }

  const actionLabel: Record<string, string> = {
    role_assign: "지정",
    role_change: "변경",
    role_revoke: "해제",
  };

  return NextResponse.json({
    ok: true,
    message: `${result.data.name}의 권한이 ${result.data.new_role}로 변경되었습니다. (${actionLabel[result.data.action] ?? "변경"})`,
  });
}
