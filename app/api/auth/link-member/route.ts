import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

interface LinkMemberBody {
  authUserId: string;
  memberId: string;
}

/**
 * POST /api/auth/link-member
 *
 * 카카오 로그인 사용자(auth.users)와 기존 회원(members)을 수동으로 연결.
 * members.auth_user_id = authUserId, is_kakao_linked = true 로 UPDATE.
 *
 * 검증 순서:
 *   1. authUserId가 auth.users에 실제로 존재하는지
 *   2. memberId가 members에 실제로 존재하는지 (admin_club_slug 기준 club 내)
 *   3. 해당 member가 이미 다른 auth 계정과 연결되어 있으면 거부
 *   4. authUserId가 이 club 안에서 이미 다른 member에 연결되어 있으면 거부
 *      (멀티클럽 정책: 같은 auth_user_id가 다른 클럽 members에 있는 것은 허용)
 *   5. UPDATE 실행
 *   6. pending_link_requests에서 해당 row 삭제 (연결 완료 정리)
 *
 * 보안:
 *   - club context: admin_club_slug 쿠키 기준 access.clubId — request body club_id 무시
 *   - service role 사용 (RLS 우회 필요), application-level club filter 적용
 *   - authUserId 존재 여부만 확인 (getUserById) — 타 클럽 연결 상태는 응답에 미포함
 *
 * 권한: kakaoIsOwner (master) 전용.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return Response.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });
  }

  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json(
      { error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." },
      { status: 400 }
    );
  }

  let body: LinkMemberBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { authUserId, memberId } = body;

  if (!authUserId || typeof authUserId !== "string") {
    return NextResponse.json({ error: "authUserId가 필요합니다." }, { status: 400 });
  }
  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1) authUserId가 auth.users에 존재하는지 확인
  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(authUserId);
  if (authUserError || !authUserData.user) {
    return NextResponse.json({ error: "해당 카카오 사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  // 2) memberId가 현재 클럽의 members에 존재하는지 확인
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, nickname, auth_user_id")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (memberError || !member) {
    // 다른 클럽 member id로 접근 시도 → 404 (club 정보 미노출)
    return NextResponse.json({ error: "해당 회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // 3) 해당 member가 이미 다른 auth 계정에 연결되어 있으면 거부
  if (member.auth_user_id !== null) {
    return NextResponse.json(
      { error: `'${member.nickname}' 회원은 이미 다른 카카오 계정과 연결되어 있습니다.` },
      { status: 409 }
    );
  }

  // 4) authUserId가 이미 이 club의 다른 member에 연결되어 있으면 거부
  //    (DB UNIQUE (club_id, auth_user_id) 제약과 이중 방어)
  const { data: alreadyLinked } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("auth_user_id", authUserId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (alreadyLinked) {
    return NextResponse.json(
      { error: `이 카카오 계정은 이미 '${alreadyLinked.nickname}' 회원과 연결되어 있습니다.` },
      { status: 409 }
    );
  }

  // 5) 연결 (is_kakao_linked도 동기화)
  const { error: updateError } = await supabase
    .from("members")
    .update({ auth_user_id: authUserId, is_kakao_linked: true })
    .eq("id", memberId)
    .eq("club_id", currentClubId);

  if (updateError) {
    // PostgreSQL unique violation (23505): UNIQUE(club_id, auth_user_id) 동시 충돌
    if ((updateError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "이 카카오 계정은 이미 다른 회원과 연결되어 있습니다." },
        { status: 409 }
      );
    }
    console.error("[link-member POST] update 실패:", updateError.message);
    return NextResponse.json({ error: "연결에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
  }

  // 6) pending_link_requests 정리 (연결 완료 → 대기 row 삭제)
  await supabase
    .from("pending_link_requests")
    .delete()
    .eq("auth_user_id", authUserId)
    .eq("club_id", currentClubId);

  return NextResponse.json({ ok: true });
}
