import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/auth/pending-users
 *
 * 보안 재설계 (V1 — cross-club data leak 수정):
 *
 * 이전 구현: auth.admin.listUsers()로 플랫폼 전체 Kakao 계정을 조회한 뒤
 *   현재 클럽 기준으로만 필터 → 다른 클럽 연결 계정의 이메일·닉네임이 노출.
 *
 * 현재 구현: pending_link_requests 테이블만 조회.
 *   - 사용자가 /auth/callback 에서 이 클럽에 미연결임을 확인한 경우에만 row 생성됨.
 *   - club_id = access.clubId 필터 → 타 클럽 pending 조회 불가.
 *   - 응답에 이메일 미포함: display_name(카카오 표시명)만 반환.
 *   - listUsers() 호출 없음 → 플랫폼 전체 계정 directory 제거.
 *
 * 권한: isOwner (master) 전용.
 * club context: admin_club_slug 쿠키 기준 access.clubId — selected_club_id 사용 금지.
 */
export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.isOwner) {
    return Response.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json(
      { error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // 현재 클럽의 pending 요청만 조회 (타 클럽 데이터 접근 없음)
  const { data: pendingRows, error } = await supabase
    .from("pending_link_requests")
    .select("auth_user_id, display_name, created_at")
    .eq("club_id", currentClubId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[pending-users GET] pending_link_requests 조회 실패:", error);
    return NextResponse.json({ error: "대기 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // 이미 연결된 auth_user_id는 목록에서 제외 (연결 완료 후 삭제 실패 케이스 방어)
  const { data: linked } = await supabase
    .from("members")
    .select("auth_user_id")
    .not("auth_user_id", "is", null)
    .eq("club_id", currentClubId);

  const linkedIds = new Set((linked ?? []).map((m) => m.auth_user_id).filter(Boolean));

  const pendingUsers = (pendingRows ?? [])
    .filter((r) => !linkedIds.has(r.auth_user_id))
    .map((r) => ({
      id: r.auth_user_id,           // auth_user_id를 id로 노출 (link-member에서 사용)
      displayName: r.display_name,  // 카카오 표시명만 (이메일 없음)
      createdAt: r.created_at,
    }));

  return NextResponse.json(
    { ok: true, pendingUsers },
    { headers: { "Cache-Control": "no-store" } }
  );
}
