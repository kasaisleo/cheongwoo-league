import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";

/**
 * POST /api/admin/events/[id]/scheduling/confirm — 스케줄 확정(confirm_event_scheduling RPC 경유, 2A-5C).
 *
 * body 없음. 이 RPC는 자체적으로 완전 idempotent(이미 확정된 상태면 재검증
 * 없이 no-op)이므로 중복 클릭이 와도 안전하다 — UI의 busy guard는 불필요한
 * 재요청을 줄이기 위한 것일 뿐, 최종 방어는 RPC. 성공 응답에 최신
 * scheduling_confirmed_at을 담지 않는다 — 0052의 confirm_event_participants
 * 라우트와 동일한 이유로, 클라이언트는 항상 GET /scheduling을 재조회한다.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("confirm_event_scheduling", {
    p_event_id: params.id,
    p_club_id: access.clubId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "스케줄 확정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
