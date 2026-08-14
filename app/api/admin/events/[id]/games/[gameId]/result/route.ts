import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid } from "@/lib/event-engine";
import type {
  EventGame,
  EventGamePlayer,
  SaveEventGameResultRow,
  ClearEventGameResultRow,
} from "@/lib/supabase/database.types";

/**
 * Event Game 결과 저장·초기화(0059, Phase 2A-7B-2D).
 *
 *   POST   → save_event_game_result   최초 저장 + 기존 결과 수정
 *   DELETE → clear_event_game_result  결과 초기화(효과 undo + Match 삭제 + draft 복구)
 *
 * 이 route는 판정을 하지 않는다. 승자 계산, Game 상태 전환, Match 생성·연결,
 * 포인트·전적 효과의 undo/apply는 전부 RPC가 단일 트랜잭션에서 결정하는
 * source of truth다. 여기서 하는 일은 (1) 관리자 인증과 club 경계 강제,
 * (2) 서버가 직접 읽은 현재 라인업을 RPC 인자로 전달, (3) 입력 형태 검증,
 * (4) 오류 메시지 매핑뿐이다.
 *
 * 선수 4명은 클라이언트에서 받지 않는다 — 서버가 event_game_players를
 * (game_id, event_id, club_id)로 직접 조회해 team/slot 대응을 만든다. 결과
 * 입력 화면은 라인업을 바꾸는 화면이 아니므로, 클라이언트가 보낸 participant를
 * 신뢰하면 "점수만 저장하려다 라인업이 조용히 바뀌는" 경로가 생긴다.
 * (라인업 변경은 별도의 players route가 담당한다.)
 *
 * club 경계: access.clubId만 신뢰한다. body/query의 club_id는 받지도 않고,
 * selected_club_id / DEFAULT_CLUB_ID / CHEONGWOO_CLUB_ID / public club context는
 * 사용하지 않는다. RPC도 (event_id, club_id)와 (game_id, event_id, club_id)로
 * 다시 검증하므로 서버 조회와 RPC 양쪽에서 교차 club 접근이 막힌다.
 */

interface SaveResultBody {
  scoreA?: unknown;
  scoreB?: unknown;
  scoreATiebreak?: unknown;
  scoreBTiebreak?: unknown;
}

/** 점수 칸 하나를 정수로 좁힌다. 빈 문자열·null·undefined는 "미입력"으로 본다. */
function parseOptionalInt(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n)) return { ok: false };
  return { ok: true, value: n };
}

const SEAT_ORDER = [
  { team: "A", slot: 1 },
  { team: "A", slot: 2 },
  { team: "B", slot: 1 },
  { team: "B", slot: 2 },
] as const;

/**
 * 현재 저장된 라인업을 A1·A2·B1·B2 순서의 participant id 4개로 만든다.
 * 복식 정원과 슬롯 구성이 완전하지 않으면 null을 돌려 호출부가 400으로 막는다.
 */
function toDoublesSeats(players: EventGamePlayer[]): [string, string, string, string] | null {
  if (players.length !== 4) return null;
  const byKey = new Map(players.map((p) => [`${p.team}:${p.slot}`, p.event_participant_id]));
  const seats = SEAT_ORDER.map((s) => byKey.get(`${s.team}:${s.slot}`));
  if (seats.some((v) => !v)) return null;
  if (new Set(seats).size !== 4) return null;
  return seats as [string, string, string, string];
}

type LoadedGame =
  | { ok: false; status: number; message: string }
  | { ok: true; game: EventGame; players: EventGamePlayer[] };

/** 결과 API가 다루는 게임인지 확인하고 현재 라인업을 함께 읽는다. */
async function loadGameAndSeats(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  gameId: string,
  clubId: string
): Promise<LoadedGame> {
  const [{ data: game, error: gameError }, { data: players, error: playersError }] = await Promise.all([
    supabase
      .from("event_games")
      .select("*")
      .eq("id", gameId)
      .eq("event_id", eventId)
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase
      .from("event_game_players")
      .select("*")
      .eq("event_game_id", gameId)
      .eq("event_id", eventId)
      .eq("club_id", clubId),
  ]);

  if (gameError || playersError) {
    console.error(
      "[admin/events/:id/games/:gameId/result]",
      gameError?.code ?? playersError?.code,
      gameError?.message ?? playersError?.message
    );
    return { ok: false, status: 500, message: "게임 정보를 불러오지 못했습니다." };
  }
  if (!game) {
    return { ok: false, status: 404, message: "게임을 찾을 수 없습니다." };
  }

  return { ok: true, game: game as EventGame, players: (players ?? []) as EventGamePlayer[] };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; gameId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!isValidUuid(params.id) || !isValidUuid(params.gameId)) {
    return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as SaveResultBody | null;
  if (!body) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const scoreA = parseOptionalInt(body.scoreA);
  const scoreB = parseOptionalInt(body.scoreB);
  const tbA = parseOptionalInt(body.scoreATiebreak);
  const tbB = parseOptionalInt(body.scoreBTiebreak);

  if (!scoreA.ok || !scoreB.ok || !tbA.ok || !tbB.ok) {
    return NextResponse.json({ error: "점수는 정수로 입력해주세요." }, { status: 400 });
  }
  if (scoreA.value === null || scoreB.value === null) {
    return NextResponse.json({ error: "양 팀 점수를 모두 입력해주세요." }, { status: 400 });
  }
  // 범위·동점·타이브레이크 필수 여부의 최종 판정은 RPC(_event_game_result_score)가
  // 하지만, 명백히 잘못된 입력은 왕복 없이 먼저 막는다.
  if (scoreA.value < 0 || scoreA.value > 7 || scoreB.value < 0 || scoreB.value > 7) {
    return NextResponse.json({ error: "점수는 0에서 7 사이여야 합니다." }, { status: 400 });
  }
  // 2A-8D: 동점 중 정확히 5:5만 무승부로 허용한다. 그 밖의 동점은 여기서 막고,
  // 5:5에는 타이브레이크를 쓸 수 없다. 최종 판정은 RPC(_event_game_result_score)와
  // DB CHECK(chk_match_outcome_consistent)가 하지만, 왕복 없이 먼저 걸러 준다.
  const isDraw = scoreA.value === 5 && scoreB.value === 5;
  if (scoreA.value === scoreB.value && !isDraw) {
    return NextResponse.json(
      { error: "동점 결과는 5:5 무승부만 저장할 수 있습니다." },
      { status: 400 }
    );
  }
  if (isDraw && (tbA.value !== null || tbB.value !== null)) {
    return NextResponse.json(
      { error: "5:5 무승부에는 타이브레이크 점수를 입력할 수 없습니다." },
      { status: 400 }
    );
  }
  if ((tbA.value === null) !== (tbB.value === null)) {
    return NextResponse.json(
      { error: "타이브레이크는 양 팀 점수를 모두 입력하거나 모두 비워주세요." },
      { status: 400 }
    );
  }
  if ((tbA.value !== null && tbA.value < 0) || (tbB.value !== null && tbB.value < 0)) {
    return NextResponse.json({ error: "타이브레이크 점수는 0 이상이어야 합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const loaded = await loadGameAndSeats(supabase, params.id, params.gameId, access.clubId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: loaded.status });
  }
  if (loaded.game.format !== "doubles") {
    return NextResponse.json({ error: "현재 결과 입력은 복식 게임만 지원합니다." }, { status: 409 });
  }

  const seats = toDoublesSeats(loaded.players);
  if (!seats) {
    return NextResponse.json(
      { error: "선수 4명이 모두 배정된 게임만 결과를 저장할 수 있습니다." },
      { status: 400 }
    );
  }

  const { data, error: rpcError } = await supabase.rpc("save_event_game_result", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_team_a_slot1_participant_id: seats[0],
    p_team_a_slot2_participant_id: seats[1],
    p_team_b_slot1_participant_id: seats[2],
    p_team_b_slot2_participant_id: seats[3],
    p_score_a: scoreA.value,
    p_score_b: scoreB.value,
    p_score_a_tiebreak: tbA.value,
    p_score_b_tiebreak: tbB.value,
    // 관리자 member row가 없을 수 있다(플랫폼 계정 등). 임의 ID를 넣지 않고
    // null로 둔다 — matches.created_by는 nullable이고 RPC도 null을 허용한다.
    p_actor_member_id: access.memberId ?? null,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "경기 결과 저장에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  // returns table(...) 이므로 supabase-js는 배열로 돌려준다.
  const row = (Array.isArray(data) ? data[0] : data) as SaveEventGameResultRow | undefined;
  if (!row) {
    console.error("[admin/events/:id/games/:gameId/result POST] empty rpc result");
    return NextResponse.json({ error: "경기 결과 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    eventGameId: row.event_game_id,
    matchId: row.match_id,
    resultAction: row.result_action,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; gameId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!isValidUuid(params.id) || !isValidUuid(params.gameId)) {
    return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data, error: rpcError } = await supabase.rpc("clear_event_game_result", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "경기 결과 초기화에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  const row = (Array.isArray(data) ? data[0] : data) as ClearEventGameResultRow | undefined;
  if (!row) {
    console.error("[admin/events/:id/games/:gameId/result DELETE] empty rpc result");
    return NextResponse.json({ error: "경기 결과 초기화에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    eventGameId: row.event_game_id,
    clearedMatchId: row.cleared_match_id,
    resultAction: row.result_action,
  });
}
