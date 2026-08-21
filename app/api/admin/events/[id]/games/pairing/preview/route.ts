import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { runEventPairing } from "@/lib/event-pairing/engine";
import {
  buildEngineArgs,
  EVENT_ID_INVALID,
  isValidEventIdParam,
  mapCaptureRpcError,
  mapEngineFailure,
  parsePreviewBody,
  UNEXPECTED_ERROR,
} from "@/lib/event-pairing/preview-contract";
import type { CaptureEventPairingInputResult } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/events/[id]/games/pairing/preview — 자동 대진 미리보기(2A-9D-B79-4).
 *
 * 처리 순서:
 *   관리자 인증 → JSON body 검증 → capture_event_pairing_input RPC
 *   → capture 결과 1행 검증 → runEventPairing → 공개 Preview 응답
 *
 * 읽기 전용이다. event_pairing_runs INSERT, Game/lineup 생성·수정이 없다 —
 * capture RPC 는 STABLE 이고 이 route 는 write RPC 를 호출하지 않는다.
 *
 * club 경계는 항상 access.clubId 만 신뢰한다 — body/query/header 의 club
 * context 는 받지도 않는다(허용 key 3개 외에는 400 으로 거부한다).
 *
 * 엔진은 반드시 server-only 경계인 engine.ts 로만 부른다. core.ts 를 직접
 * import 하지 않는다.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  // RPC 인자가 uuid 타입이라 잘못된 URL 문자열을 넘기면 cast 오류가 난다.
  // 사용자 실수를 500 으로 보이게 하지 않도록 RPC 호출 전에 거른다.
  if (!isValidEventIdParam(params.id)) {
    return NextResponse.json({ error: EVENT_ID_INVALID.error }, { status: EVENT_ID_INVALID.status });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parsePreviewBody(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.value;

  const supabase = createServiceClient();

  // target 배열은 원본 그대로 넘긴다 — dedupe/정렬/개수 계약은 0079 RPC 정본이다.
  const { data, error: rpcError } = await supabase.rpc("capture_event_pairing_input", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_target_game_ids: body.targetGameIds,
  });

  if (rpcError) {
    // 원문은 서버 로그에만 남기고 client 에는 매핑된 문구만 준다.
    console.error("[pairing/preview capture]", rpcError.code, rpcError.message);
    const info = mapCaptureRpcError(rpcError.message);
    return NextResponse.json({ error: info.error }, { status: info.status });
  }

  const built = buildEngineArgs(data as CaptureEventPairingInputResult[] | null, body);
  if (!built.ok) {
    console.error("[pairing/preview capture-shape] unexpected capture row shape");
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  let result;
  try {
    result = runEventPairing(built.args);
  } catch (e) {
    // 산술 overflow·canonical 직렬화 실패 등 내부 오류. 세부는 노출하지 않는다.
    console.error("[pairing/preview engine]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: UNEXPECTED_ERROR.error }, { status: UNEXPECTED_ERROR.status });
  }

  if (!result.ok) {
    const info = mapEngineFailure(result);
    if (info.status >= 500) {
      console.error("[pairing/preview engine-failure]", result.reason);
      return NextResponse.json({ error: info.error }, { status: info.status });
    }
    return NextResponse.json(
      { ok: false, error: info.error, code: info.code, ...(info.evidence ? { evidence: info.evidence } : {}) },
      { status: info.status },
    );
  }

  // 엔진 성공 결과만 반환한다 — config_snapshot / input_snapshot 은 응답에 넣지 않는다.
  return NextResponse.json({
    ok: true,
    algorithmVersion: result.algorithmVersion,
    seed: result.seed,
    inputHash: result.inputHash,
    resultHash: result.resultHash,
    games: result.games,
    summary: result.summary,
    warnings: result.warnings,
  });
}
