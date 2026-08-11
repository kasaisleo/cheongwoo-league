import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";

/**
 * POST /api/admin/events/[id]/games/[gameId]/cancel — 게임 취소(2A-6B).
 *
 * 물리 삭제는 제공하지 않는다(0054 정책 — cancelled 게임도 이력으로 영구
 * 보존). 그래서 DELETE로 위장하지 않고 명시적 액션 라우트로 둔다.
 * draft → cancelled만 실제 전이이고, 이미 cancelled면 RPC가 no-op으로
 * 성공 반환한다(중복 클릭 안전).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; gameId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!isValidUuid(params.gameId)) {
    return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("cancel_event_game", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "게임 취소에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
