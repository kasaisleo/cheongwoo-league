import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const VALID_MODES = ["new-match", "edit-match", "records"] as const;
type GuestListMode = (typeof VALID_MODES)[number];

function isValidMode(value: string | null): value is GuestListMode {
  return value !== null && (VALID_MODES as readonly string[]).includes(value);
}

/**
 * GET /api/admin/guests-list?mode=new-match|edit-match|records
 *
 * Admin 화면(신규/수정 매치 선수 후보, 선수 기록 분석)이 브라우저에서
 * 직접 guests를 조회하던 것을 대체하는 공용 엔드포인트. members-list와
 * 동일하게 service-role + access.clubId로만 스코프한다 — clubId를 쿼리
 * 파라미터로 받지 않는다(신뢰 금지).
 *
 * mode는 화이트리스트로만 허용한다 — 임의 조합 필터를 열어두지 않는다:
 *   new-match:  is_active=true, converted_to_member_id is null, created_at desc
 *   edit-match: 필터 없음(비활성 게스트도 과거 매치 편집 후보로 유지), name asc
 *   records:    is_active=true, converted_to_member_id is null, name asc
 *
 * 반환은 id, name만.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");
  if (!isValidMode(mode)) {
    return NextResponse.json({ error: "mode가 올바르지 않습니다." }, { status: 400 });
  }

  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const clubId = access.clubId;

  const admin = createServiceClient();
  let query = admin.from("guests").select("id, name").eq("club_id", clubId);

  if (mode === "new-match" || mode === "records") {
    query = query.eq("is_active", true).is("converted_to_member_id", null);
  }

  query = mode === "new-match"
    ? query.order("created_at", { ascending: false })
    : query.order("name", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("[admin/guests-list]", error.code, error.message);
    return NextResponse.json({ error: "게스트 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ guests: data ?? [] });
}
