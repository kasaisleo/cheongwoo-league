import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";

const MAX_GAME_IDS = 500;

/**
 * POST /api/admin/events/[id]/games/reorder — none 모드 실행 큐 재정렬(2A-6B).
 *
 * reorder_event_games는 slot_mode='none'일 때만 실행 가능하고, 대상은
 * "status=draft이고 event_session_id가 null인" 게임 전체 집합이다(코트만
 * 지정된 게임도 포함). ordered/timed는 슬롯의 position/시각이 실행 순서의
 * 유일한 근거라 이 RPC 자체가 거부한다 — 라우트에서 모드를 따로 판단하지
 * 않고 RPC 판정을 그대로 전달한다.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { gameIds?: unknown } | null;
  const gameIds = body?.gameIds;

  if (
    !Array.isArray(gameIds) ||
    gameIds.length === 0 ||
    gameIds.length > MAX_GAME_IDS ||
    !gameIds.every((id) => isValidUuid(id)) ||
    new Set(gameIds).size !== gameIds.length
  ) {
    return NextResponse.json({ error: "올바르지 않은 재정렬 요청입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("reorder_event_games", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_game_ids: gameIds,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "순서 변경에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
