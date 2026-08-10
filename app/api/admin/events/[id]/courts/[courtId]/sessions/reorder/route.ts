import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";

const MAX_SESSION_IDS = 500;

/**
 * POST /api/admin/events/[id]/courts/[courtId]/sessions/reorder
 * 슬롯 재정렬(reorder_event_sessions RPC 경유, 2A-5B) — 해당 코트의 활성 세션
 * 전체 집합과 정확히 일치해야 한다(부분 배열 불가) — RPC가 최종 검증.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; courtId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  if (!isValidUuid(params.courtId)) {
    return NextResponse.json({ error: "코트를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { sessionIds?: unknown } | null;
  const sessionIds = body?.sessionIds;

  if (
    !Array.isArray(sessionIds) ||
    sessionIds.length === 0 ||
    sessionIds.length > MAX_SESSION_IDS ||
    !sessionIds.every((id) => isValidUuid(id)) ||
    new Set(sessionIds).size !== sessionIds.length
  ) {
    return NextResponse.json({ error: "올바르지 않은 재정렬 요청입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("reorder_event_sessions", {
    p_event_court_id: params.courtId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_session_ids: sessionIds,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "슬롯 재정렬에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
