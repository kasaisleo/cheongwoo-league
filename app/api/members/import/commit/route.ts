import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { StagingMember } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

interface CommitImportBody {
  stagingIds: string[];
}

/**
 * 운영진이 최종 확인한 staging_members 행들을 members에 반영한다.
 * 신규 회원만 반영 가능 — validation_status가 'valid'인 행만 허용한다.
 * (duplicate, missing_required, needs_review 등은 운영진이 staging_members에서
 * 직접 보정하거나 건너뛰어야 하며, 이 API는 그 상태를 그대로 반영하지 않는다.)
 *
 * 권한(Step 8-3): owner 전용 — 일괄 임포트 플로우의 일부.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json(
      { error: "이 작업은 owner만 가능합니다." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as CommitImportBody;
  const { stagingIds } = body;

  if (!stagingIds || stagingIds.length === 0) {
    return NextResponse.json({ error: "반영할 행을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  const { data: rows, error: fetchError } = await supabase
    .from("staging_members")
    .select("*")
    .in("id", stagingIds);

  if (fetchError || !rows) {
    return NextResponse.json({ error: "대상 데이터를 불러오지 못했습니다." }, { status: 500 });
  }

  const invalidRows = (rows as StagingMember[]).filter((r) => r.validation_status !== "valid");
  if (invalidRows.length > 0) {
    return NextResponse.json(
      { error: "신규 회원(valid 상태)만 반영할 수 있습니다. 선택한 항목 중 일부가 valid 상태가 아닙니다." },
      { status: 400 }
    );
  }

  // is_active/is_dormant는 DB DEFAULT(true/false)에 암묵적으로 의존하지 않고
  // 명시적으로 지정한다 — 일괄 임포트로 들어오는 회원도 신규 등록과 같은
  // 기본값 정책(role: null, is_active: true, is_dormant: false)을 따른다.
  const memberInserts = (rows as StagingMember[]).map((r) => ({
    name: r.normalized_name!,
    nickname: r.normalized_nickname || r.normalized_name!,
    club_id: currentClubId,
    phone: r.normalized_phone,
    grade: "C" as const,
    role: null,
    mapo_score: r.normalized_mapo_score,
    member_type: (r.normalized_member_type as "정회원" | "준회원" | "게스트") ?? "정회원",
    address_full: r.normalized_address,
    district: r.normalized_district,
    age: r.corrected_age,
    league_point: 0,
    wins: 0,
    losses: 0,
    permission_role: "member" as const,
    is_kakao_linked: false,
    is_active: true,
    is_dormant: false,
  }));

  const { data: insertedMembers, error: insertError } = await supabase
    .from("members")
    .insert(memberInserts)
    .select("id");

  if (insertError || !insertedMembers) {
    return NextResponse.json({ error: "회원 반영에 실패했습니다." }, { status: 500 });
  }

  // staging_members는 임시 작업 공간이라 데이터를 영구 보존하지 않지만, 같은 업로드
  // 배치 안에서 "이미 반영했는지" 구분이 필요하므로 즉시 삭제하지 않고 imported로
  // 표시만 해둔다. 다음 새 파일 업로드 시점에 staging_members가 전체 초기화되면서
  // 이 표시도 함께 사라진다 — 즉 imported 상태 자체를 영구 이력으로 쓰지 않는다.
  await supabase
    .from("staging_members")
    .update({ validation_status: "imported", imported_at: new Date().toISOString() })
    .in("id", stagingIds);

  return NextResponse.json({ ok: true, importedCount: insertedMembers.length });
}
