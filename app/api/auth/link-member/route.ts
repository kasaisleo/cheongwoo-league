import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

interface LinkMemberBody {
  authUserId: string;
  memberId: string;
}

/**
 * 카카오 로그인 사용자(auth.users)와 기존 회원(members)을 수동으로 연결.
 * members.auth_user_id = authUserId 로 UPDATE.
 *
 * 검증 순서:
 *   1. authUserId가 auth.users에 실제로 존재하는지
 *   2. memberId가 members에 실제로 존재하는지
 *   3. 해당 member가 이미 다른 auth 계정과 연결되어 있으면 거부
 *   4. authUserId가 이미 다른 member에 연결되어 있으면 거부 (DB unique로도 막히지만 친절한 에러를 위해 사전 체크)
 *
 * 권한: manager 이상(requireAdmin).
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isOwner) return Response.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });

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

  // 2) memberId가 members에 존재하는지 확인, 동시에 현재 auth_user_id도 가져온다
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, nickname, auth_user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ error: "해당 회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // 3) 해당 member가 이미 다른 auth 계정에 연결되어 있으면 거부
  if (member.auth_user_id !== null) {
    return NextResponse.json(
      { error: `'${member.nickname}' 회원은 이미 다른 카카오 계정과 연결되어 있습니다.` },
      { status: 409 }
    );
  }

  // 4) authUserId가 이미 다른 member에 연결되어 있으면 거부
  const { data: alreadyLinked } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (alreadyLinked) {
    return NextResponse.json(
      { error: `이 카카오 계정은 이미 '${alreadyLinked.nickname}' 회원과 연결되어 있습니다.` },
      { status: 409 }
    );
  }

  // 5) 연결
  const { error: updateError } = await supabase
    .from("members")
    .update({ auth_user_id: authUserId })
    .eq("id", memberId);

  if (updateError) {
    console.error("[link-member POST] update 실패:", updateError);
    return NextResponse.json({ error: "연결에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
