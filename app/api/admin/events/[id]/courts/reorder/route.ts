import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";

const MAX_COURT_IDS = 500;

/**
 * POST /api/admin/events/[id]/courts/reorder — 코트 재정렬(reorder_event_courts RPC 경유, 2A-5B).
 * 입력은 활성 코트 전체 집합과 정확히 일치해야 한다(부분 배열 불가) — RPC가 최종 검증.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { courtIds?: unknown } | null;
  const courtIds = body?.courtIds;

  if (
    !Array.isArray(courtIds) ||
    courtIds.length === 0 ||
    courtIds.length > MAX_COURT_IDS ||
    !courtIds.every((id) => isValidUuid(id)) ||
    new Set(courtIds).size !== courtIds.length
  ) {
    return NextResponse.json({ error: "올바르지 않은 재정렬 요청입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("reorder_event_courts", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_court_ids: courtIds,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "코트 재정렬에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
