import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, isValidIsoTimestamp, isValidBoundedString, isValidPosition } from "@/lib/event-engine";

const LABEL_MAX_LENGTH = 60;

/**
 * POST /api/admin/events/[id]/courts/[courtId]/sessions — 슬롯 생성(create_event_session RPC 경유, 2A-5B).
 *
 * slotMode별 필드 제한(none=생성불가/ordered=시각금지/timed=시각필수)은 UI가
 * 먼저 막지만, 여기서는 재검증하지 않고 그대로 RPC에 전달한다 — 최종 방어는
 * _event_session_validate_mode(RPC 내부)이지 이 라우트가 아니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; courtId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  if (!isValidUuid(params.courtId)) {
    return NextResponse.json({ error: "코트를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    position?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    label?: unknown;
  } | null;
  const { position, startsAt, endsAt, label } = body ?? {};

  if (position !== undefined && position !== null && !isValidPosition(position)) {
    return NextResponse.json({ error: "올바르지 않은 순서 값입니다." }, { status: 400 });
  }
  if ((startsAt === undefined || startsAt === null) !== (endsAt === undefined || endsAt === null)) {
    return NextResponse.json({ error: "시작 시각과 종료 시각을 모두 입력해주세요." }, { status: 400 });
  }
  if (startsAt !== undefined && startsAt !== null && !isValidIsoTimestamp(startsAt)) {
    return NextResponse.json({ error: "올바르지 않은 시작 시각입니다." }, { status: 400 });
  }
  if (endsAt !== undefined && endsAt !== null && !isValidIsoTimestamp(endsAt)) {
    return NextResponse.json({ error: "올바르지 않은 종료 시각입니다." }, { status: 400 });
  }
  if (
    isValidIsoTimestamp(startsAt) &&
    isValidIsoTimestamp(endsAt) &&
    new Date(endsAt).getTime() <= new Date(startsAt).getTime()
  ) {
    return NextResponse.json({ error: "종료 시각은 시작 시각보다 늦어야 합니다." }, { status: 400 });
  }
  if (label !== undefined && label !== null && !isValidBoundedString(label, LABEL_MAX_LENGTH)) {
    return NextResponse.json({ error: "슬롯 라벨을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: sessionId, error: rpcError } = await supabase.rpc("create_event_session", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_event_court_id: params.courtId,
    p_position: position ?? null,
    p_starts_at: startsAt ?? null,
    p_ends_at: endsAt ?? null,
    p_label: label !== undefined && label !== null ? (label as string).trim() : null,
  });

  if (rpcError || !sessionId) {
    const { status, message } = mapEventRpcError(rpcError?.message, "슬롯 생성에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, id: sessionId });
}
