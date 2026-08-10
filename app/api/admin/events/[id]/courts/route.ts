import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError, isValidBoundedString, isValidPosition } from "@/lib/event-engine";

const NAME_MAX_LENGTH = 40;

/**
 * POST /api/admin/events/[id]/courts — 코트 생성(create_event_court RPC 경유, 2A-5B).
 *
 * 이벤트 소유권 재검증은 이 라우트가 직접 하지 않는다 — RPC 내부의
 * p_event_id+p_club_id WHERE가 최종 검증이며, 불일치 시 EVENT_NOT_FOUND →
 * mapEventRpcError가 404로 매핑(다른 club 이벤트의 존재 여부를 흘리지 않음).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown; position?: unknown } | null;
  const name = body?.name;
  const position = body?.position;

  if (!isValidBoundedString(name, NAME_MAX_LENGTH)) {
    return NextResponse.json({ error: "코트 이름을 입력해주세요." }, { status: 400 });
  }
  if (position !== undefined && position !== null && !isValidPosition(position)) {
    return NextResponse.json({ error: "올바르지 않은 순서 값입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: courtId, error: rpcError } = await supabase.rpc("create_event_court", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_name: name.trim(),
    p_position: position ?? null,
  });

  if (rpcError || !courtId) {
    const { status, message } = mapEventRpcError(rpcError?.message, "코트 생성에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, id: courtId });
}
