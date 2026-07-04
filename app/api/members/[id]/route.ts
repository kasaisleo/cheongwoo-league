import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, requireRole, getAdminRole } from "@/lib/admin-auth";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { isValidPlayerBackground } from "@/lib/constants/member-timeline";
import type { MemberGrade, MemberRole } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

interface UpdateMemberBody {
  name?: string;
  nickname?: string | null;
  phone?: string;
  age?: number | null;
  addressFull?: string | null;
  district?: string | null;
  grade?: MemberGrade;
  mapoScore?: number | null;
  /** 운영 직책. null이면 직책 없음으로 변경. */
  role?: MemberRole | null;
  /** 휴면회원 여부. is_active(삭제/숨김)와 별개 — false는 활동, true는 휴면. */
  isDormant?: boolean;
  memo?: string | null;
  playerBackground?: string;
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

/** 010으로 시작하는 숫자만 11자리 */
const PHONE_REGEX = /^010\d{8}$/;

interface RouteParams {
  params: { id: string };
}

/**
 * 회원 정보 수정. manager 이상 가능.
 * 추후 카카오 로그인 도입 시: 본인은 자신의 정보를 수정할 수 있게 허용 예정.
 *
 * 수정 가능 항목: 이름, 닉네임, 전화번호, 나이, 주소, district, grade, 마포점수,
 * 직책(role), 휴면 여부(isDormant), 메모, 선수출신. 그 외 항목(회원구분/LP/승패 등)은
 * 이 API의 대상이 아니다.
 *
 * 권한 세분화(Step 8-3): 직책(role)만 owner 전용이다. body에 role 필드가
 * 포함되어 있는데 owner가 아니면, 그 필드만 조용히 무시하지 않고 요청
 * 전체를 403으로 거부한다 — 권한 없는 필드 변경 시도를 명확하게 실패시켜야
 * "저장은 됐는데 직책만 안 바뀌었다"는 혼란을 막을 수 있고, 디버깅/QA도
 * 쉬워진다. 이 체크는 DB 조회보다 먼저 수행해 부분 처리가 생기지 않게 한다.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const putAccess = await getAdminAccessServer();
  if (!putAccess.isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const memberId = params.id;
  const body = (await request.json()) as UpdateMemberBody;
  const {
    name,
    nickname,
    phone,
    age,
    addressFull,
    district,
    grade,
    mapoScore,
    role,
    isDormant,
    memo,
    playerBackground,
  } = body;

  // role(직책) 변경은 owner 전용. body에 role 키 자체가 있으면(null로 직책을
  // 해제하는 경우도 포함) owner 여부를 확인한다 — manager가 role: null을
  // 보내 직책을 지우는 것도 막아야 하므로 "값이 truthy인지"가 아니라
  // "필드가 존재하는지"로 판단한다.
  if (role !== undefined && !putAccess.isOwner) {
    return NextResponse.json(
      { error: "직책 변경은 최고관리자만 가능합니다." },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  const { data: existingMember, error: fetchError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .single();

  if (fetchError || !existingMember) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let trimmedName: string | null = null;

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }
    trimmedName = name.trim();
    updates.name = trimmedName;
  }

  if (nickname !== undefined) {
    updates.nickname = nickname?.trim() || trimmedName || existingMember.name;
  }

  if (phone !== undefined) {
    if (!phone.trim()) {
      return NextResponse.json({ error: "휴대폰 번호를 입력해주세요." }, { status: 400 });
    }
    const digitsOnlyPhone = phone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digitsOnlyPhone)) {
      return NextResponse.json(
        { error: "휴대폰 번호는 010으로 시작하는 11자리여야 합니다." },
        { status: 400 }
      );
    }

    // phone 중복 체크 — 본인은 제외
    const { data: duplicateCheck } = await supabase
      .from("members")
      .select("id")
      .eq("phone", digitsOnlyPhone)
      .eq("club_id", currentClubId)
      .neq("id", memberId)
      .limit(1);

    if (duplicateCheck && duplicateCheck.length > 0) {
      return NextResponse.json(
        { error: "이미 등록된 휴대폰 번호입니다." },
        { status: 409 }
      );
    }

    updates.phone = digitsOnlyPhone;
  }

  if (age !== undefined) {
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
      return NextResponse.json({ error: "나이는 숫자만 입력해주세요." }, { status: 400 });
    }
    updates.age = age;
  }

  if (addressFull !== undefined) {
    updates.address_full = addressFull?.trim() || null;
  }

  if (district !== undefined) {
    updates.district = district?.trim() || null;
  }

  if (grade !== undefined) {
    if (!VALID_GRADES.includes(grade)) {
      return NextResponse.json({ error: "실력 등급이 올바르지 않습니다." }, { status: 400 });
    }
    updates.grade = grade;
  }

  if (mapoScore !== undefined) {
    if (mapoScore !== null && (!Number.isInteger(mapoScore) || mapoScore < 1 || mapoScore > 10)) {
      return NextResponse.json(
        { error: "마포구 대회 점수는 1~10 사이여야 합니다." },
        { status: 400 }
      );
    }
    updates.mapo_score = mapoScore;
  }

  if (role !== undefined) {
    // role은 직책이 없으면 null — 그 자체로 유효하다(QA 케이스: 직책 있음 → 없음).
    // 값이 있을 때만 VALID_ROLES로 검증한다.
    if (role !== null && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "직책이 올바르지 않습니다." }, { status: 400 });
    }
    updates.role = role;
  }

  if (isDormant !== undefined) {
    if (typeof isDormant !== "boolean") {
      return NextResponse.json({ error: "휴면 여부가 올바르지 않습니다." }, { status: 400 });
    }
    updates.is_dormant = isDormant;
  }

  if (memo !== undefined) {
    updates.memo = memo?.trim() || null;
  }

  if (playerBackground !== undefined) {
    if (!isValidPlayerBackground(playerBackground)) {
      return NextResponse.json({ error: "선수출신 정보가 올바르지 않습니다." }, { status: 400 });
    }
    updates.player_background = playerBackground;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const { data: updatedMember, error: updateError } = await supabase
    .from("members")
    .update(updates)
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .select()
    .single();

  if (updateError || !updatedMember) {
    return NextResponse.json({ error: "회원 정보 수정에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member: updatedMember });
}

/**
 * 회원 soft delete. 실제로 행을 지우지 않고 is_active=false로만 표시한다.
 * 경기/출석/LP 이력은 member_id로 연결되어 있어 그대로 보존된다.
 *
 * 권한(Step 8-3): owner 전용. soft delete라도 회원이 모든 화면에서 즉시
 * 사라지는 가장 파급력 큰 동작이고, 복구 API/UI가 없어 신중함이 필요하다.
 * 추후 카카오 로그인 도입 시에도 본인 삭제는 허용하지 않는다 — 항상 owner만 가능.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.isOwner) return Response.json({ error: "회원 탈퇴 처리는 master/owner만 가능합니다." }, { status: 403 });

  const memberId = params.id;
  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  const { data: existingMember, error: fetchError } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .single();

  if (fetchError || !existingMember) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("members")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("club_id", currentClubId);

  if (updateError) {
    return NextResponse.json({ error: "회원 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
