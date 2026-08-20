import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, parseGenderCategory } from "@/lib/event-engine";

/**
 * PATCH /api/admin/events/[id]/games/[gameId]/gender-category — Game 종류 지정/해제(0076).
 *
 * 다른 Game 변경 라우트와 같은 분리 원칙을 따른다: 종류만 바꾸고 선수(/players)·
 * 배치(/place)·format(/[gameId])·상태(/cancel)·순서(/reorder)는 건드리지 않는다.
 *
 * 계약:
 *   genderCategory: "mens" | "womens" | "mixed" | "open" | null
 *   - key 가 없으면 400 — "무엇을 하려는지" 를 body 모양으로 추측하지 않는다.
 *   - null 은 "해제" 라는 명시적 요청이다. 완성된 lineup 이 있으면 RPC 가 즉시
 *     재판정해 inferred 로 두고, lineup 이 없으면 종류를 모두 지운다.
 *   - 값을 지정하면 configured 가 되고, 기존 lineup 이 조건을 어기면 RPC 가
 *     409 로 거부한다 — 부족한 인원을 잡복으로 자동 완화하지 않는다.
 *
 * Club context 는 access.clubId 하나뿐이다. body/query 의 club_id 는 읽지 않는다.
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = parseGenderCategory(
    Object.prototype.hasOwnProperty.call(body, "genderCategory") ? body.genderCategory : undefined
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("set_event_game_gender_category", {
    p_game_id: params.gameId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_gender_category: parsed.value,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "게임 종류 변경에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
