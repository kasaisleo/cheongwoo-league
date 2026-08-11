import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";

/**
 * POST /api/admin/events/[id]/games/[gameId]/place — 코트·슬롯 배치 변경(2A-6B).
 *
 * 두 값은 "원하는 최종 상태"다(부분 갱신 아님). 둘 다 null이면 미배치로
 * 되돌린다. slot_mode별 허용 조합(none=court만/session 불가, ordered·timed=
 * 배치 시 court+session 필수)과 세션-코트 소속 일치, 슬롯 중복 배치, 동일
 * 참가자 시간 충돌은 전부 place_event_game RPC가 최종 검증한다 — 이 라우트는
 * uuid 형식만 먼저 거른다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; gameId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!isValidUuid(params.gameId)) {
    return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventCourtId?: unknown;
    eventSessionId?: unknown;
  } | null;
  const eventCourtId = body?.eventCourtId ?? null;
  const eventSessionId = body?.eventSessionId ?? null;

  if (eventCourtId !== null && !isValidUuid(eventCourtId)) {
    return NextResponse.json({ error: "코트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (eventSessionId !== null && !isValidUuid(eventSessionId)) {
    return NextResponse.json({ error: "슬롯을 찾을 수 없습니다." }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("place_event_game", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_event_court_id: eventCourtId,
    p_event_session_id: eventSessionId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "배치에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
