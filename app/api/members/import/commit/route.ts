import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import type { StagingMember } from "@/lib/supabase/database.types";

interface CommitImportBody {
  stagingIds: string[];
}

/**
 * 운영진이 최종 확인한 staging_members 행들을 members에 반영한다.
 * 신규 회원만 반영 가능 — validation_status가 'valid'인 행만 허용한다.
 * (duplicate, missing_required, needs_review 등은 운영진이 staging_members에서
 * 직접 보정하거나 건너뛰어야 하며, 이 API는 그 상태를 그대로 반영하지 않는다.)
 */
export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as CommitImportBody;
  const { stagingIds } = body;

  if (!stagingIds || stagingIds.length === 0) {
    return NextResponse.json({ error: "반영할 행을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

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

  const memberInserts = (rows as StagingMember[]).map((r) => ({
    name: r.normalized_name!,
    nickname: r.normalized_nickname || r.normalized_name!,
    phone: r.normalized_phone,
    grade: "C" as const,
    role: "정회원" as const,
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
  }));

  const { data: insertedMembers, error: insertError } = await supabase
    .from("members")
    .insert(memberInserts)
    .select("id");

  if (insertError || !insertedMembers) {
    return NextResponse.json({ error: "회원 반영에 실패했습니다." }, { status: 500 });
  }

  // staging_members를 imported로 표시 (데이터는 삭제하지 않고 보존)
  await supabase
    .from("staging_members")
    .update({ validation_status: "imported", imported_at: new Date().toISOString() })
    .in("id", stagingIds);

  return NextResponse.json({ ok: true, importedCount: insertedMembers.length });
}
