import { NextRequest, NextResponse } from "next/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { unlinkMemberKakao } from "@/lib/club-admin-audit-log";

/**
 * POST /api/admin/unlink-member
 * members.auth_user_id = null + is_kakao_linked = false 처리.
 * 실제 mutation + audit insert(action: kakao_unlink)는 unlink_member_kakao
 * RPC(DB 함수)가 단일 트랜잭션으로 처리한다.
 *
 * 보호 규칙(RPC 내부에서 actor 재검증 포함 전부 재확인됨):
 *   - master 계정 연결 해제 금지
 *   - 본인 계정 연결 해제 금지
 *   - 이미 미연결 회원은 400
 *   - cross-club 접근은 club_id scope로 member_not_found(404) 처리
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner || !access.clubId || !access.userId) {
    return NextResponse.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const { memberId } = await request.json() as { memberId?: string };
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const result = await unlinkMemberKakao({
    clubId: access.clubId,
    actorAuthUserId: access.userId,
    targetMemberId: memberId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: result.error.status });
  }

  return NextResponse.json({ ok: true, message: `${result.data.name} 계정의 카카오 연결이 해제되었습니다.` });
}
