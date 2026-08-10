import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidUuid, isValidBoundedString, isValidPosition } from "@/lib/event-engine";

const NAME_MAX_LENGTH = 40;

/**
 * PATCH /api/admin/events/[id]/courts/[courtId] — 코트 수정(update_event_court RPC 경유, 2A-5B).
 * name/position/isActive 전부 선택 필드 — 보낸 것만 반영(RPC의 coalesce 계약과 동일).
 */
export async function PATCH(
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
    name?: unknown;
    position?: unknown;
    isActive?: unknown;
  } | null;
  const { name, position, isActive } = body ?? {};

  if (name !== undefined && !isValidBoundedString(name, NAME_MAX_LENGTH)) {
    return NextResponse.json({ error: "코트 이름을 입력해주세요." }, { status: 400 });
  }
  if (position !== undefined && !isValidPosition(position)) {
    return NextResponse.json({ error: "올바르지 않은 순서 값입니다." }, { status: 400 });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json({ error: "올바르지 않은 활성 상태 값입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("update_event_court", {
    p_court_id: params.courtId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_name: name !== undefined ? (name as string).trim() : null,
    p_position: position ?? null,
    p_is_active: isActive ?? null,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "코트 수정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
