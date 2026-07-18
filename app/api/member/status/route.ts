import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/member/status?clubId=<uuid>
 *
 * Public 회원 전용 — 로그인 세션(auth)과 클럽 회원 연결(member) 여부를 분리해서 반환한다.
 * 0037(members/member_stats ACL 잠금)로 브라우저에서 public.members를 직접 조회할 수 없게 된 뒤,
 * MemberAuthBar가 이 API로 로그인 표시를 판정한다.
 *
 * admin_club_slug/admin 컨텍스트에 의존하는 /api/auth/status와는 별개 — 재사용 금지.
 *
 * 응답에는 UI에 필요한 최소 필드만 포함한다.
 * phone/address/memo/auth_user_id/kakao_provider_id 등 PII는 절대 포함하지 않는다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      linked: false,
      memberId: null,
      memberName: null,
      nickname: null,
      permissionRole: null,
    });
  }

  const supabaseAdmin = createServiceClient();

  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("status", "active")
    .maybeSingle();

  if (!club) {
    return NextResponse.json({
      authenticated: true,
      linked: false,
      memberId: null,
      memberName: null,
      nickname: null,
      permissionRole: null,
    });
  }

  // 기존 MemberAuthBar 조회와 동일한 조건 유지 (auth_user_id + club_id만 —
  // is_active/deleted_at 필터는 기존에도 없었으므로 이번 수정으로 새로 추가하지 않는다).
  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, nickname, name, permission_role")
    .eq("auth_user_id", user.id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({
      authenticated: true,
      linked: false,
      memberId: null,
      memberName: null,
      nickname: null,
      permissionRole: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    linked: true,
    memberId: member.id,
    memberName: member.name,
    nickname: member.nickname,
    permissionRole: member.permission_role,
  });
}
