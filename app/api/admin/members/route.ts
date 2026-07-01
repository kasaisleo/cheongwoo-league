import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { MemberGrade, MemberType } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/members
 * 관리자 전용 회원/게스트 등록 API.
 *
 * 기존 POST /api/members와 차이:
 *   - 권한: getAdminAccessServer().isAdmin (카카오 manager/admin/master/owner 모두 허용)
 *   - phone: 선택 (게스트는 전화번호 없이 등록 가능)
 *   - mapoScore: 선택 (게스트 등록 시 생략 가능)
 *
 * 보안 강제값 (클라이언트 payload 무시):
 *   - permission_role = "member"  (마스터 지정 불가)
 *   - is_active = true
 *   - auth_user_id = null         (카카오 연결은 auth-link 플로우에서만)
 *   - is_kakao_linked = false
 *   - deleted_at = null
 *   - wins = 0, losses = 0, league_point = 0
 */

const VALID_GRADES: MemberGrade[] = ["A", "B", "C", "D"];
const VALID_MEMBER_TYPES: MemberType[] = ["정회원", "준회원", "게스트"];
const PHONE_REGEX = /^010\d{8}$/;

/** 이름 공백 정규화: 내부 연속 공백 제거 후 trim */
function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

interface CreateMemberBody {
  name: string;
  nickname?: string;
  phone?: string;
  grade: MemberGrade;
  memberType: MemberType;
  mapoScore?: number | null;
  addressFull?: string;
  district?: string;
  age?: number | null;
  memo?: string;
  playerBackground?: string;
}

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json()) as CreateMemberBody;
  const { name, nickname, phone, grade, memberType, mapoScore, addressFull, district, age, memo, playerBackground } = body;

  // 이름 정규화 (내부 공백 제거)
  const normalizedName = normalizeName(name ?? "");
  if (!normalizedName) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  // 닉네임 정규화
  const normalizedNickname = nickname?.trim() ? nickname.trim() : normalizedName;

  // 등급 검증
  if (!VALID_GRADES.includes(grade)) {
    return NextResponse.json({ error: "실력 등급을 선택해주세요." }, { status: 400 });
  }

  // 회원구분 검증
  if (!memberType || !VALID_MEMBER_TYPES.includes(memberType)) {
    return NextResponse.json({ error: "회원구분이 올바르지 않습니다." }, { status: 400 });
  }

  // 전화번호 (선택) — 입력한 경우만 검증
  let digitsPhone: string | null = null;
  if (phone?.trim()) {
    digitsPhone = phone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digitsPhone)) {
      return NextResponse.json(
        { error: "휴대폰 번호는 010으로 시작하는 11자리여야 합니다." },
        { status: 400 }
      );
    }
  }

  // 마포점수 (선택)
  const resolvedMapoScore = mapoScore ?? null;
  if (resolvedMapoScore !== null) {
    if (!Number.isInteger(resolvedMapoScore) || resolvedMapoScore < 1 || resolvedMapoScore > 10) {
      return NextResponse.json(
        { error: "마포구 대회 점수는 1~10 사이여야 합니다." },
        { status: 400 }
      );
    }
  }

  const supabase = createServiceClient();

  // 전화번호 중복 체크 (입력한 경우만)
  if (digitsPhone) {
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("phone", digitsPhone)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "이미 등록된 휴대폰 번호입니다." }, { status: 409 });
    }
  }

  const { data: member, error: insertError } = await supabase
    .from("members")
    .insert({
      name: normalizedName,
      nickname: normalizedNickname,
      phone: digitsPhone,
      grade,
      role: null,
      mapo_score: resolvedMapoScore,
      member_type: memberType,
      address_full: addressFull?.trim() || null,
      district: district?.trim() || null,
      age: age ?? null,
      memo: memo?.trim() || null,
      // 보안 강제값 — 클라이언트 payload 무시
      permission_role: "member",
      is_active: true,
      is_dormant: false,
      is_kakao_linked: false,
      auth_user_id: null,
      player_background: playerBackground ?? "none",
      league_point: 0,
      wins: 0,
      losses: 0,
    })
    .select()
    .single();

  if (insertError || !member) {
    console.error("[admin/members POST]", insertError);
    return NextResponse.json({ error: "회원 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memberId: member.id });
}
