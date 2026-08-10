import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";

/**
 * POST /api/admin/events/[id]/participants/confirm
 *
 * confirm_event_participants RPC 경유(2A-4B). 이 RPC는 정수(전환된 행 수)만
 * 반환한다 — participants_confirmed_at의 최신값은 이 응답에 없다. 클라이언트는
 * 이 응답을 받은 뒤 반드시 Event를 다시 GET해서 실제 DB 값을 확인해야 한다
 * (여기서 now()를 만들어 응답에 끼워 넣지 않는다 — source of truth는 재조회뿐).
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error: rpcError } = await supabase.rpc("confirm_event_participants", {
    p_event_id: params.id,
    p_club_id: access.clubId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "참가자 명단 확정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, transitionedCount: data });
}
