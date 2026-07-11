import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/server";
import { MembersPageClient } from "./MembersPageClient";

export const dynamic = "force-dynamic";

export interface AdminMemberRow {
  id: string;
  name: string;
  nickname: string;
  phone: string | null;
  member_type: string;
  permission_role: string;
  is_active: boolean;
  is_dormant: boolean;
  deleted_at: string | null;
  auth_user_id: string | null;
  created_at: string;
}

/**
 * /admin/members — 서버 wrapper.
 *
 * club context는 access.clubId만 사용한다 — selected_club_id/getCurrentClubId() 사용 금지
 * (멀티클럽 context 오염 방지, 기존 admin 서브페이지들과 동일 정책).
 *
 * deleted_at/is_active로 미리 필터하지 않고 전부 가져온다 — 탈퇴·비활성 회원도
 * 운영자가 찾아서 복구 판단을 할 수 있어야 하는 목록이라(public 회원 명단과 달리),
 * 클라이언트에서 필터로 나눠 보여준다.
 */
export default async function AdminMembersPage() {
  const access = await getAdminAccessServer();
  const currentClubId = access.clubId ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, nickname, phone, member_type, permission_role, is_active, is_dormant, deleted_at, auth_user_id, created_at")
    .eq("club_id", currentClubId)
    .order("name", { ascending: true });

  const members = (data ?? []) as AdminMemberRow[];

  return <MembersPageClient members={members} />;
}
