import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, parseGameLineup } from "@/lib/event-engine";
import type { EventGameFormat } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/events/[id]/games/[gameId]/players — 라인업 전체 교체(2A-6B).
 *
 * set_event_game_players RPC 계약 그대로 "전체 교체"다 — 부분 추가/삭제 API가
 * 아니다. format은 바꾸지 않으므로 현재 게임의 format 카디널리티를 그대로
 * 요구한다(RPC가 최종 검증). 형식 검증에 필요한 format은 클라이언트를 믿지
 * 않고 DB에서 다시 읽는다.
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

  const body = (await request.json().catch(() => null)) as { players?: unknown } | null;

  const supabase = createServiceClient();

  // format을 body에서 받지 않는다 — 현재 저장된 값으로만 정원을 판단한다.
  // event_id + club_id를 함께 걸어 타 클럽/타 이벤트 게임은 404로 통일한다.
  const { data: game, error: gameError } = await supabase
    .from("event_games")
    .select("id, format")
    .eq("id", params.gameId)
    .eq("event_id", params.id)
    .eq("club_id", access.clubId)
    .maybeSingle();

  if (gameError) {
    console.error("[admin/events/:id/games/:gameId/players POST]", gameError.code, gameError.message);
    return NextResponse.json({ error: "선수 지정에 실패했습니다." }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
  }

  const parsed = parseGameLineup(body?.players, game.format as EventGameFormat);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("set_event_game_players", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_participant_ids: parsed.lineup.participantIds,
    p_teams: parsed.lineup.teams,
    p_slots: parsed.lineup.slots,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "선수 지정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
