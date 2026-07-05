import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { MemberGrade } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

interface ConvertGuestBody {
  guestId: string;
  nickname: string;
  grade: MemberGrade;
  phone?: string;
}

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json(
      { error: "운영진 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as ConvertGuestBody;
  const { guestId, nickname, grade, phone } = body;

  if (!guestId || !nickname?.trim() || !grade) {
    return NextResponse.json({ error: "닉네임과 등급을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  // 1. 게스트 정보 조회
  const { data: guest, error: fetchError } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .eq("club_id", currentClubId)
    .single();

  if (fetchError || !guest) {
    return NextResponse.json({ error: "게스트 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (guest.converted_to_member_id) {
    return NextResponse.json({ error: "이미 정회원으로 전환된 게스트입니다." }, { status: 409 });
  }

  // 2. 회원으로 등록. role은 직책 없음(null), member_type은 정회원으로 명시한다 —
  // DB 컬럼 DEFAULT에 암묵적으로 의존하지 않는다(DEFAULT가 바뀌면 여기 의도와
  // 다르게 조용히 따라 바뀔 수 있어, 신규 회원 등록 기본값 정책을 코드에서
  // 직접 보장한다).
  const { data: newMember, error: insertError } = await supabase
    .from("members")
    .insert({
      name: guest.name,
      nickname: nickname.trim(),
      club_id: currentClubId,
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

  // 3. 게스트 레코드에 전환 결과 기록 (게스트 레코드는 보존)
  await supabase
    .from("guests")
    .update({ converted_to_member_id: newMember.id })
    .eq("id", guestId)
    .eq("club_id", currentClubId);

  return NextResponse.json({ ok: true, memberId: newMember.id });
}
