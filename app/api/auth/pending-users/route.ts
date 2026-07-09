import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

export async function GET() {
  const access = await getAdminAccessServer();
  if (!access.isOwner) return Response.json({ error: "Owner 또는 master 권한이 필요합니다." }, { status: 403 });

  // admin_club_slug 기준 club context — selected_club_id 사용 금지
  const currentClubId = access.clubId;
  if (!currentClubId) {
    return NextResponse.json({ error: "관리 클럽 context가 없습니다. /admin에서 클럽을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    console.error("[pending-users GET] listUsers 실패:", usersError);
    return NextResponse.json({ error: "사용자 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // 카카오 필터: identities가 null인 경우를 포함해 app_metadata 기준도 함께 사용
  const kakaoUsers = usersData.users.filter(
    (u) =>
      u.identities?.some((identity) => identity.provider === "kakao") ||
      u.app_metadata?.provider === "kakao" ||
      (u.app_metadata?.providers as string[] | undefined)?.includes("kakao")
  );

  // 이미 연결된 auth_user_id 목록
  const { data: linkedMembers, error: membersError } = await supabase
    .from("members")
    .select("auth_user_id")
    .not("auth_user_id", "is", null)
    .eq("club_id", currentClubId);

  if (membersError) {
    console.error("[pending-users GET] members 조회 실패:", membersError);
    return NextResponse.json({ error: "회원 데이터를 불러오지 못했습니다." }, { status: 500 });
  }

  const linkedIds = new Set(
    (linkedMembers ?? []).map((m) => m.auth_user_id).filter(Boolean)
  );

  const pendingUsers = kakaoUsers
    .filter((u) => !linkedIds.has(u.id))
    .map((u) => {
      const kakaoIdentity = u.identities?.find((i) => i.provider === "kakao");
      return {
        id: u.id,
        email: u.email ?? null,
        nickname:
          (u.user_metadata?.name as string | undefined) ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.preferred_username as string | undefined) ??
          (u.user_metadata?.user_name as string | undefined) ??
          null,
        kakaoId: kakaoIdentity?.identity_data?.id ?? null,
        createdAt: u.created_at,
      };
    });

  return NextResponse.json({ ok: true, pendingUsers });
}
