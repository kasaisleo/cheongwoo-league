import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import type { EnsureEventGameCountRow } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/events/[id]/games/bulk — 빈 doubles draft Game 일괄 확보(0061, 2A-8B).
 *
 * body: { targetCount: number }
 *
 * "목표 수까지 채운다"는 멱등 연산이다. 이미 목표에 도달했거나 목표가 현재보다
 * 작으면 아무것도 생성하지 않고 카운터만 돌려준다 — 기존 Game을 취소·삭제하는
 * 경로는 없다.
 *
 * club 경계는 항상 access.clubId만 신뢰한다 — body/query의 club_id는 받지도
 * 않는다. Event 상태·참가자 확정·인원 최소치·position 충돌은 전부 RPC가 최종
 * 판정하고, 이 라우트는 정수·범위만 먼저 걸러 불필요한 DB 왕복을 줄인다.
 */

// 0061의 RPC 상한과 반드시 같은 값이어야 한다. 근거는 migration 주석 참조 —
// 요약하면 reorder(MAX_GAME_IDS=500)가 미배치 큐 전체를 한 배열로 요구하므로
// 하드 상한이 500이고, 하루 운영 현실치(코트 4개 × 4시간 ≒ 32경기)의 6배인
// 200을 실사용 상한으로 둔다.
const MIN_TARGET_COUNT = 1;
const MAX_TARGET_COUNT = 200;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { targetCount?: unknown } | null;
  const { targetCount } = body ?? {};

  // 문자열 "5"도 거부한다 — 숫자 타입이 아니면 애초에 받지 않는다.
  if (
    typeof targetCount !== "number" ||
    !Number.isInteger(targetCount) ||
    targetCount < MIN_TARGET_COUNT ||
    targetCount > MAX_TARGET_COUNT
  ) {
    return NextResponse.json(
      { error: `목표 게임 수를 ${MIN_TARGET_COUNT} ~ ${MAX_TARGET_COUNT} 사이 정수로 입력해주세요.` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error: rpcError } = await supabase.rpc("ensure_event_game_count", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_target_count: targetCount,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "게임 일괄 생성에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  // returns table(...) 이므로 배열로 온다.
  const row = (Array.isArray(data) ? data[0] : data) as EnsureEventGameCountRow | undefined | null;
  if (!row) {
    console.error("[admin/events/:id/games/bulk POST] empty rpc result");
    return NextResponse.json({ error: "게임 일괄 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    targetCount: row.target_count,
    previousCount: row.previous_count,
    createdCount: row.created_count,
    finalCount: row.final_count,
  });
}
