import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * POST /api/guests — 게스트 신규 등록.
 * 권한: manager/admin/master/owner (kakaoIsAdmin)
 * club_id는 admin_club_slug 쿠키 → access.clubId 경로로만 결정.
 * 클라이언트가 보낸 club_id는 신뢰하지 않는다.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!access.clubId) {
    return NextResponse.json({ error: "클럽 컨텍스트가 없습니다. 관리자 게이트웨이에서 클럽을 선택해주세요." }, { status: 403 });
  }
  const clubId = access.clubId;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, "").trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  const visitDate = typeof body.visit_date === "string" ? body.visit_date : null;
  if (!visitDate) {
    return NextResponse.json({ error: "방문 날짜를 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: guest, error: insertError } = await supabase
    .from("guests")
    .insert({
      name,
      club_id: clubId,
      visit_date: visitDate,
      phone: typeof body.phone === "string" && body.phone ? body.phone.replace(/\D/g, "") || null : null,
      age: typeof body.age === "number" ? body.age : null,
      years_playing: typeof body.years_playing === "number" ? body.years_playing : null,
      referred_by: typeof body.referred_by === "string" && body.referred_by ? body.referred_by : null,
      skill_grade: typeof body.skill_grade === "string" && body.skill_grade ? body.skill_grade : null,
      manner_score: typeof body.manner_score === "number" ? body.manner_score : null,
      reinvite: typeof body.reinvite === "boolean" ? body.reinvite : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("id")
    .single();

  if (insertError || !guest) {
    console.error("[POST /api/guests] insert 실패:", insertError?.message);
    return NextResponse.json({ error: "게스트 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guestId: guest.id });
}
