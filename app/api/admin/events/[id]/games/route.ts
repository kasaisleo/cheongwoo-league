import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, parseGameLineup } from "@/lib/event-engine";
import type {
  EventGame,
  EventGameFormat,
  EventGamePlayer,
  EventGameResult,
  EventGameWithPlayers,
  EventParticipant,
  Match,
} from "@/lib/supabase/database.types";

/**
 * GET  /api/admin/events/[id]/games — 이 Event의 대진 스냅샷(2A-6B).
 * POST /api/admin/events/[id]/games — 수동 draft 게임 생성(create_event_game RPC).
 *
 * club 경계는 항상 access.clubId만 신뢰한다 — body/query의 club_id는 받지도
 * 않는다. 게임/세션/참가자가 같은 event·club에 속하는지는 RPC의 복합 FK와
 * 명시적 검증이 최종 방어선이고, 여기서는 uuid 형식과 라인업 형식만 먼저
 * 걸러 불필요한 DB 왕복을 줄인다.
 */

interface GamesResponse {
  games: EventGameWithPlayers[];
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();

  // id만으로 조회하지 않는다 — club_id를 함께 걸어 타 클럽 존재 여부도 흘리지 않는다.
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", params.id)
    .eq("club_id", access.clubId)
    .maybeSingle();

  if (eventError) {
    console.error("[admin/events/:id/games GET]", eventError.code, eventError.message);
    return NextResponse.json({ error: "대진을 불러오지 못했습니다." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  const [{ data: games, error: gamesError }, { data: players, error: playersError }, { data: parts, error: partsError }] =
    await Promise.all([
      supabase
        .from("event_games")
        .select("*")
        .eq("event_id", params.id)
        .eq("club_id", access.clubId)
        // position만으로는 동률에서 순서가 비결정적이다(Postgres가 tie를 보장하지
        // 않는다). id를 최종 tie-breaker로 둔다 — created_at은 같은 시각이 나올 수
        // 있어 tie-breaker로 쓰지 않는다. 0060 이후 새 중복은 생기지 않지만,
        // 그 전에 만들어진 중복이 남아 있어도 응답 순서는 항상 같아야 한다.
        .order("position", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("event_game_players")
        .select("*")
        .eq("event_id", params.id)
        .eq("club_id", access.clubId),
      supabase
        .from("event_participants")
        .select("id, display_name_snapshot")
        .eq("event_id", params.id)
        .eq("club_id", access.clubId),
    ]);

  if (gamesError || playersError || partsError) {
    console.error(
      "[admin/events/:id/games GET]",
      gamesError?.code ?? playersError?.code ?? partsError?.code,
      gamesError?.message ?? playersError?.message ?? partsError?.message
    );
    return NextResponse.json({ error: "대진을 불러오지 못했습니다." }, { status: 500 });
  }

  // 확정 결과는 연결된 Match가 유일한 원본이다(0057/0059 — event_games에는
  // 점수 컬럼이 없다). 이 Event의 게임 id로만 좁혀 조회하고 club_id도 함께
  // 걸어 다른 클럽의 Match가 섞이지 않게 한다.
  const gameIds = ((games ?? []) as EventGame[]).map((g) => g.id);
  let resultByGameId = new Map<string, EventGameResult>();
  if (gameIds.length > 0) {
    const { data: linked, error: linkedError } = await supabase
      .from("matches")
      .select("id, event_game_id, score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team, played_at")
      .in("event_game_id", gameIds)
      .eq("club_id", access.clubId);

    if (linkedError) {
      console.error("[admin/events/:id/games GET]", linkedError.code, linkedError.message);
      return NextResponse.json({ error: "대진을 불러오지 못했습니다." }, { status: 500 });
    }

    resultByGameId = new Map(
      ((linked ?? []) as Array<Pick<Match, "id" | "event_game_id" | "score_a" | "score_b" | "score_a_tiebreak" | "score_b_tiebreak" | "winner_team" | "played_at">>)
        .filter((m): m is typeof m & { event_game_id: string } => m.event_game_id !== null)
        .map((m) => [
          m.event_game_id,
          {
            match_id: m.id,
            score_a: m.score_a,
            score_b: m.score_b,
            score_a_tiebreak: m.score_a_tiebreak,
            score_b_tiebreak: m.score_b_tiebreak,
            winner_team: m.winner_team,
            played_at: m.played_at,
          },
        ])
    );
  }

  const nameById = new Map(
    ((parts ?? []) as Pick<EventParticipant, "id" | "display_name_snapshot">[]).map((p) => [
      p.id,
      p.display_name_snapshot,
    ])
  );

  const playersByGame = new Map<string, EventGameWithPlayers["players"]>();
  for (const gp of (players ?? []) as EventGamePlayer[]) {
    const list = playersByGame.get(gp.event_game_id) ?? [];
    list.push({
      event_participant_id: gp.event_participant_id,
      team: gp.team,
      slot: gp.slot,
      display_name: nameById.get(gp.event_participant_id) ?? "(알 수 없음)",
    });
    playersByGame.set(gp.event_game_id, list);
  }

  const body: GamesResponse = {
    games: ((games ?? []) as EventGame[]).map((g) => ({
      ...g,
      players: (playersByGame.get(g.id) ?? []).sort(
        (a, b) => a.team.localeCompare(b.team) || a.slot - b.slot
      ),
      result: resultByGameId.get(g.id) ?? null,
    })),
  };

  return NextResponse.json(body);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    format?: unknown;
    players?: unknown;
    eventCourtId?: unknown;
    eventSessionId?: unknown;
  } | null;
  const { format, players, eventCourtId, eventSessionId } = body ?? {};

  if (format !== "singles" && format !== "doubles") {
    return NextResponse.json({ error: "단식/복식을 선택해주세요." }, { status: 400 });
  }
  if (eventCourtId !== undefined && eventCourtId !== null && !isValidUuid(eventCourtId)) {
    return NextResponse.json({ error: "코트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (eventSessionId !== undefined && eventSessionId !== null && !isValidUuid(eventSessionId)) {
    return NextResponse.json({ error: "슬롯을 찾을 수 없습니다." }, { status: 404 });
  }

  const parsed = parseGameLineup(players, format as EventGameFormat);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: gameId, error: rpcError } = await supabase.rpc("create_event_game", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_format: format,
    p_participant_ids: parsed.lineup.participantIds,
    p_teams: parsed.lineup.teams,
    p_slots: parsed.lineup.slots,
    p_event_court_id: eventCourtId ?? null,
    p_event_session_id: eventSessionId ?? null,
    p_created_by: access.memberId,
  });

  if (rpcError || !gameId) {
    const { status, message } = mapEventRpcError(rpcError?.message, "대진 생성에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, id: gameId }, { status: 201 });
}
