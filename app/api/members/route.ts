import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, getAdminRole } from "@/lib/admin-auth";
import type { MemberGrade, MemberRole, MemberType } from "@/lib/supabase/database.types";

interface CreateMemberBody {
  name: string;
  nickname?: string | null;
  phone: string;
  grade: MemberGrade;
  /** 운영 직책. 직책이 없으면 null. */
  role: MemberRole | null;
  mapoScore: number;
  memberType: MemberType;
  addressFull?: string | null;
  district?: string | null;
  age?: number | null;
}

const VALID_GRADES: MemberGrade[] = ["A", "B", "C", "D"];
const VALID_ROLES: MemberRole[] = [
  "회장",
  "부회장",
  "총무",
  "경기이사",
  "홍보이사",
  "운영이사",
  "섭외이사",
  "고문",
];
const VALID_MEMBER_TYPES: MemberType[] = ["정회원", "준회원", "게스트"];

/** 010으로 시작하는 숫자만 11자리 */
const PHONE_REGEX = /^010\d{8}$/;

export async function POST(request: NextRequest) {
  // members에는 휴대폰/주소/나이 등 개인정보가 포함되므로, RLS로 anon insert를
  // 열어두지 않고 항상 이 서버 라우트(운영진 인증 + service-role)를 통해서만 등록한다.
  const authError = requireAdmin();
  if (authError) return authError;

  const body = (await request.json()) as CreateMemberBody;
  const { name, nickname, phone, grade, role, mapoScore, memberType, addressFull, district, age } =
    body;

  // role(직책) 지정은 owner 전용. POST의 role은 필수 필드(CreateMemberBody.role)라
  // PUT처럼 "필드가 존재하는지(!== undefined)"로는 판단할 수 없다 — 매번
  // 항상 존재하기 때문이다. 그래서 "null이 아닌 값을 보냈는지"로 판단한다.
  // null(직책 없음)은 manager도 보낼 수 있고, 정상 등록 폼은 항상 null을
  // 보내도록 이미 UI에서 강제되어 있어 일상 흐름에서는 이 체크에 걸리지
  // 않는다 — 이건 API를 직접 호출하는 시도를 막는 안전망이다.
  // 다른 입력 검증이나 phone 중복 체크(DB 조회)보다 먼저 막아서, 권한이
  // 없는 요청이 부분적으로라도 처리되지 않게 한다.
  if (role !== null && getAdminRole() !== "owner") {
    return NextResponse.json(
      { error: "직책 지정은 owner만 가능합니다." },
      { status: 403 }
    );
  }

  // --- 필수값 검증 ---
  if (!name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  if (!phone?.trim()) {
    return NextResponse.json({ error: "휴대폰 번호를 입력해주세요." }, { status: 400 });
  }

  const digitsOnlyPhone = phone.replace(/\D/g, "");
  if (!PHONE_REGEX.test(digitsOnlyPhone)) {
    return NextResponse.json(
      { error: "휴대폰 번호는 010으로 시작하는 11자리여야 합니다." },
      { status: 400 }
    );
  }

  if (mapoScore === undefined || mapoScore === null) {
    return NextResponse.json({ error: "마포점수를 선택해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(mapoScore) || mapoScore < 1 || mapoScore > 10) {
    return NextResponse.json(
      { error: "마포구 대회 점수는 1~10 사이여야 합니다." },
      { status: 400 }
    );
  }

  if (!memberType) {
    return NextResponse.json({ error: "회원구분을 선택해주세요." }, { status: 400 });
  }
  if (!VALID_MEMBER_TYPES.includes(memberType)) {
    return NextResponse.json({ error: "회원구분이 올바르지 않습니다." }, { status: 400 });
  }

  if (!VALID_GRADES.includes(grade)) {
    return NextResponse.json({ error: "실력 등급이 올바르지 않습니다." }, { status: 400 });
  }
  // role은 직책이 없으면 null — 그 자체로 유효하다. 값이 있을 때만 VALID_ROLES로 검증한다.
  if (role !== null && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "직책이 올바르지 않습니다." }, { status: 400 });
  }

  if (age !== undefined && age !== null) {
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      return NextResponse.json({ error: "나이는 숫자만 입력해주세요." }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  // --- phone 중복 체크 ---
  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("phone", digitsOnlyPhone)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "이미 등록된 휴대폰 번호입니다." },
      { status: 409 }
    );
  }

  // --- 등록 ---
  // is_active/is_dormant는 DB DEFAULT(true/false)에 암묵적으로 의존하지 않고
  // 명시적으로 지정한다 — 신규 회원 등록 기본값 정책을 코드가 직접 보장한다.
  const { data: member, error: insertError } = await supabase
    .from("members")
    .insert({
      name: name.trim(),
      nickname: nickname?.trim() || name.trim(),
      phone: digitsOnlyPhone,
      grade,
      role,
      mapo_score: mapoScore,
      member_type: memberType,
      address_full: addressFull?.trim() || null,
      district: district?.trim() || null,
      age: age ?? null,
      league_point: 0,
      wins: 0,
      losses: 0,
      permission_role: "member",
      is_kakao_linked: false,
      is_active: true,
      is_dormant: false,
    })
    .select()
    .single();

  if (insertError || !member) {
    console.error("[members POST] insert 실패:", insertError);
    return NextResponse.json({ error: "회원 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memberId: member.id });
}
