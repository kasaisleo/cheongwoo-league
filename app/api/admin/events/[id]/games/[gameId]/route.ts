import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, parseGameLineup } from "@/lib/event-engine";
import type { EventGameFormat } from "@/lib/supabase/database.types";

/**
 * PATCH /api/admin/events/[id]/games/[gameId] — 게임 자체 정보 변경(2A-6B).
 *
 * 이 phase에서 변경 가능한 필드는 format뿐이다(코트/슬롯은 /place, 선수는
 * /players, 상태는 /cancel, 순서는 /reorder가 전담 — RPC 계약과 동일한 분리).
 *
 * update_event_game은 "format 미지정"과 "format을 null로 지정"을 구분하기 위해
 * p_format_supplied 플래그를 받는다. 이 라우트는 body에 format 키가 실제로
 * 있었는지로 그 플래그를 결정한다. format을 바꿀 때는 새 카디널리티에 맞는
 * 전체 라인업이 함께 와야 하고(RPC가 강제), format 변경 없이 선수만 바꾸려는
 * 호출은 RPC가 거부하며 /players를 쓰라고 알려준다.
 */
export async function PATCH(
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
    format?: unknown;
    players?: unknown;
  } | null;

  const formatSupplied = body !== null && Object.prototype.hasOwnProperty.call(body, "format");
  const format = body?.format;

  if (formatSupplied && format !== "singles" && format !== "doubles") {
    // 명시적 null 포함 — RPC도 동일하게 거부하지만 DB 왕복 없이 먼저 거른다.
    return NextResponse.json({ error: "단식/복식 값이 올바르지 않습니다." }, { status: 400 });
  }

  let participantIds: string[] | null = null;
  let teams: ("A" | "B")[] | null = null;
  let slots: number[] | null = null;

  if (body?.players !== undefined && body?.players !== null) {
    if (!formatSupplied) {
      // format을 바꾸지 않으면서 선수만 교체하는 것은 /players의 책임이다.
      return NextResponse.json(
        { error: "선수만 변경하려면 선수 지정 API를 사용해주세요." },
        { status: 400 }
      );
    }
    const parsed = parseGameLineup(body.players, format as EventGameFormat);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    participantIds = parsed.lineup.participantIds;
    teams = parsed.lineup.teams;
    slots = parsed.lineup.slots;
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("update_event_game", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_format_supplied: formatSupplied,
    p_format: formatSupplied ? (format as EventGameFormat) : null,
    p_participant_ids: participantIds,
    p_teams: teams,
    p_slots: slots,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "게임 수정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
