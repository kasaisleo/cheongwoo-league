import { notFound } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createClient } from "@/lib/supabase/server";
import { AdminMemberDetailClient } from "./AdminMemberDetailClient";

export const dynamic = "force-dynamic";

export interface AdminMemberDetail {
  id: string;
  name: string;
  nickname: string;
  phone: string | null;
  age: number | null;
  district: string | null;
  address_full: string | null;
  mapo_score: number | null;
  role: string | null;
  memo: string | null;
  player_background: string;
  member_type: string;
  permission_role: string;
  is_active: boolean;
  is_dormant: boolean;
  deleted_at: string | null;
  auth_user_id: string | null;
  created_at: string;
}

/**
 * /admin/members/[id] — Admin Members 전용 회원 상세.
 *
 * club context는 access.clubId만 사용한다 — 요청 body/query의 club_id는 신뢰하지 않는다.
 * memberId가 존재하지 않거나 다른 club 소속이면(club_id로 이미 scope된 쿼리이므로
 * member가 null) notFound()로 진짜 404를 반환한다.
 *
 * `/admin/records/players/member/[id]`(기록 분석 전용)와는 별개 경로다 — 회원관리
 * 진입점(목록/상세/수정/복구/연결해제)은 이 경로만 쓰고, 기록 열람은 이 페이지에서
 * 링크로만 연결한다.
 */
export default async function AdminMemberDetailPage({ params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  const clubId = access.clubId ?? "";

  const supabase = createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, name, nickname, phone, age, district, address_full, mapo_score, role, memo, player_background, member_type, permission_role, is_active, is_dormant, deleted_at, auth_user_id, created_at")
    .eq("id", params.id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!member) notFound();

  const isSelf = !!access.userId && access.userId === member.auth_user_id;

  return (
    <AdminMemberDetailClient
      member={member as AdminMemberDetail}
      isOwner={access.isOwner}
      isSelf={isSelf}
    />
  );
}
