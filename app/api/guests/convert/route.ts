import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import type { MemberGrade } from "@/lib/supabase/database.types";

interface ConvertGuestBody {
  guestId: string;
  nickname: string;
  grade: MemberGrade;
  phone?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as ConvertGuestBody;
  const { guestId, nickname, grade, phone } = body;

  if (!guestId || !nickname?.trim() || !grade) {
    return NextResponse.json({ error: "닉네임과 등급을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. 게스트 정보 조회
  const { data: guest, error: fetchError } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .single();

  if (fetchError || !guest) {
    return NextResponse.json({ error: "게스트 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (guest.converted_to_member_id) {
    return NextResponse.json({ error: "이미 정회원으로 전환된 게스트입니다." }, { status: 409 });
  }

  // 2. 회원으로 등록 (역할은 기본값 '정회원')
  const { data: newMember, error: insertError } = await supabase
    .from("members")
    .insert({
      name: guest.name,
      nickname: nickname.trim(),
      grade,
      phone: phone?.trim() || null,
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
    .eq("id", guestId);

  return NextResponse.json({ ok: true, memberId: newMember.id });
}
