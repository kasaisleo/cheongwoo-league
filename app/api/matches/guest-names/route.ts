import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

/**
 * GET /api/matches/guest-names?clubId=<uuid>&ids=<uuid,uuid,...>
 *
 * 매치 히스토리 상세(참석자별 기록)에 필요한 게스트 이름 조회 API.
 * guests는 anon/authenticated GRANT가 없으므로(guests P0) 브라우저에서
 * 직접 조회할 수 없다 — service-role로 조회하되 clubId로 재검증해 다른
 * 클럽 게스트가 섞이지 않게 한다.
 *
 * is_active 필터를 걸지 않는다 — 과거 매치에 참여한 뒤 비활성화된
 * 게스트의 이름도 히스토리에는 그대로 남아 있어야 한다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId || !UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("status", "active")
    .maybeSingle();

  if (clubError) {
    return NextResponse.json({ error: "클럽 조회 실패" }, { status: 500 });
  }
  if (!club) {
    return NextResponse.json({ guests: [] });
  }

  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = [
    ...new Set(
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
    ),
  ].slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ guests: [] });
  }

  const { data, error } = await admin
    .from("guests")
    .select("id, name")
    .in("id", ids)
    .eq("club_id", clubId);

  if (error) {
    console.error("[matches/guest-names]", error.code, error.message);
    return NextResponse.json({ error: "게스트 이름을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ guests: data ?? [] });
}
