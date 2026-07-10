import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { MemberGrade } from "@/lib/supabase/database.types";

interface ConvertGuestBody {
  guestId: string;
  nickname: string;
  grade: MemberGrade;
  phone?: string;
}

/**
 * POST /api/guests/convert — 게스트 → 정회원 전환.
 * club_id는 access.clubId로만 결정.
 * guestId + club_id 복합 조회로 다른 클럽 record 접근을 차단한다.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json(
      { error: "운영진 권한이 필요합니다." },
      { status: 403 }
    );
  }
  if (!access.clubId) {
    return NextResponse.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });
  }
  const clubId = access.clubId;

  const body = (await request.json()) as ConvertGuestBody;
  const { guestId, nickname, grade, phone } = body;

  if (!guestId || !nickname?.trim() || !grade) {
    return NextResponse.json({ error: "닉네임과 등급을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. 게스트 정보 조회 — club_id + id 복합 필터로 cross-club 접근 차단
  const { data: guest, error: fetchError } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .eq("club_id", clubId)
    .single();

  if (fetchError || !guest) {
    return NextResponse.json({ error: "게스트 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (guest.converted_to_member_id) {
    return NextResponse.json({ error: "이미 정회원으로 전환된 게스트입니다." }, { status: 409 });
  }

  // 2. 회원으로 등록
  const { data: newMember, error: insertError } = await supabase
    .from("members")
    .insert({
      name: guest.name,
      nickname: nickname.trim(),
      club_id: clubId,
      grade,
      phone: phone?.trim() || null,
      role: null,
      member_type: "정회원",
      is_active: true,
      is_dormant: false,
    })
    .select()
    .single();

  if (insertError || !newMember) {
    return NextResponse.json({ error: "회원 등록에 실패했습니다." }, { status: 500 });
  }

  // 3. 게스트 레코드에 전환 결과 기록
  await supabase
    .from("guests")
    .update({ converted_to_member_id: newMember.id })
    .eq("id", guestId)
    .eq("club_id", clubId);

  return NextResponse.json({ ok: true, memberId: newMember.id });
}
