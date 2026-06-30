import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * 대기 중인 카카오 사용자 목록 반환.
 * "대기 중" = auth.users에 카카오 로그인으로 생성됐지만
 * members.auth_user_id에 아직 연결되지 않은 사용자.
 *
 * 권한: manager 이상(requireAdmin) — 회원 수정과 동일 범주.
 * Supabase Admin API(service-role)로 auth.users를 조회하므로
 * createServiceClient()를 사용한다.
 */
export async function GET(request: Request) {
  const authError = requireAdmin();
  if (authError) return authError;

  const supabase = createServiceClient();

  // 1) auth.users 전체 조회 (Admin API — service-role 필요)
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    console.error("[pending-users GET] listUsers 실패:", usersError);
    return NextResponse.json({ error: "사용자 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // 디버그 모드: ?debug=1 쿼리 파라미터가 있으면 첫 번째 user의 raw 데이터를 반환.
  // identities/app_metadata/user_metadata 구조를 실제로 확인하기 위한 임시 엔드포인트.
  // 확인 후 반드시 이 블록을 제거할 것.
  const url = new URL(request.url);
  if (url.searchParams.get("debug") === "1") {
    const firstUser = usersData.users[0] ?? null;
    return NextResponse.json({
      totalUsers: usersData.users.length,
      firstUser: firstUser
        ? {
            id: firstUser.id,
            email: firstUser.email,
            app_metadata: firstUser.app_metadata,
            user_metadata: firstUser.user_metadata,
            identities: firstUser.identities,
            created_at: firstUser.created_at,
          }
        : null,
    });
  }

  // 2) 카카오 로그인으로 가입된 사용자만 추린다.
  // identities[].provider === "kakao" 로 필터 — app_metadata.provider도 함께 시도한다.
  const kakaoUsers = usersData.users.filter(
    (u) =>
      u.identities?.some((identity) => identity.provider === "kakao") ||
      u.app_metadata?.provider === "kakao" ||
      (u.app_metadata?.providers as string[] | undefined)?.includes("kakao")
  );

  if (kakaoUsers.length === 0) {
    return NextResponse.json({ ok: true, users: [] });
  }

  // 3) members 테이블에서 이미 연결된 auth_user_id 목록 조회
  const { data: linkedMembers, error: membersError } = await supabase
    .from("members")
    .select("auth_user_id")
    .not("auth_user_id", "is", null);

  if (membersError) {
    console.error("[pending-users GET] members 조회 실패:", membersError);
    return NextResponse.json({ error: "회원 데이터를 불러오지 못했습니다." }, { status: 500 });
  }

  const linkedIds = new Set(
    (linkedMembers ?? []).map((m) => m.auth_user_id).filter(Boolean)
  );

  // 4) 아직 연결되지 않은 카카오 사용자만 반환
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

  return NextResponse.json({ ok: true, users: pendingUsers });
}
