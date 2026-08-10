import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, isValidIsoTimestamp, isValidBoundedString, isValidPosition } from "@/lib/event-engine";

const LABEL_MAX_LENGTH = 60;

/**
 * PATCH /api/admin/events/[id]/sessions/[sessionId] — 슬롯 수정(update_event_session RPC 경유, 2A-5B).
 *
 * 세션의 코트 간 이동은 지원하지 않는다 — update_event_session에 코트 변경
 * 인자가 없고(2A-5B 확정 정책), 이 라우트도 body에 courtId를 받지 않는다.
 * 시각/라벨은 3-상태(미터치/clear/새 값) 그대로 RPC에 전달한다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  if (!isValidUuid(params.sessionId)) {
    return NextResponse.json({ error: "슬롯을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    position?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    clearTimes?: unknown;
    label?: unknown;
    clearLabel?: unknown;
    isActive?: unknown;
  } | null;
  const { position, startsAt, endsAt, clearTimes, label, clearLabel, isActive } = body ?? {};

  if (position !== undefined && !isValidPosition(position)) {
    return NextResponse.json({ error: "올바르지 않은 순서 값입니다." }, { status: 400 });
  }
  if (clearTimes !== undefined && typeof clearTimes !== "boolean") {
    return NextResponse.json({ error: "올바르지 않은 요청입니다." }, { status: 400 });
  }
  if (clearLabel !== undefined && typeof clearLabel !== "boolean") {
    return NextResponse.json({ error: "올바르지 않은 요청입니다." }, { status: 400 });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json({ error: "올바르지 않은 활성 상태 값입니다." }, { status: 400 });
  }
  if ((startsAt !== undefined) !== (endsAt !== undefined)) {
    return NextResponse.json({ error: "시작 시각과 종료 시각을 모두 입력해주세요." }, { status: 400 });
  }
  if (startsAt !== undefined && !isValidIsoTimestamp(startsAt)) {
    return NextResponse.json({ error: "올바르지 않은 시작 시각입니다." }, { status: 400 });
  }
  if (endsAt !== undefined && !isValidIsoTimestamp(endsAt)) {
    return NextResponse.json({ error: "올바르지 않은 종료 시각입니다." }, { status: 400 });
  }
  if (
    isValidIsoTimestamp(startsAt) &&
    isValidIsoTimestamp(endsAt) &&
    new Date(endsAt).getTime() <= new Date(startsAt).getTime()
  ) {
    return NextResponse.json({ error: "종료 시각은 시작 시각보다 늦어야 합니다." }, { status: 400 });
  }
  if (label !== undefined && !isValidBoundedString(label, LABEL_MAX_LENGTH)) {
    return NextResponse.json({ error: "슬롯 라벨을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("update_event_session", {
    p_session_id: params.sessionId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_position: position ?? null,
    p_starts_at: startsAt ?? null,
    p_ends_at: endsAt ?? null,
    p_clear_times: clearTimes ?? false,
    p_label: label !== undefined ? (label as string).trim() : null,
    p_clear_label: clearLabel ?? false,
    p_is_active: isActive ?? null,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "슬롯 수정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
