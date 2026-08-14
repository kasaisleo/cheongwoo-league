import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import type { MatchSlotMode, UpdateEventSlotModeRow } from "@/lib/supabase/database.types";

/**
 * PATCH /api/admin/events/[id]/slot-mode — 운영 방식만 변경(0063, 2A-8C).
 *
 * body: { slotMode: "none" | "ordered" | "timed" }
 *
 * 기존 PATCH /events/[id]는 match_config를 통째로 덮어쓰는 구조라 slot_mode
 * 하나를 바꾸는 데 쓰면 다른 설정 키가 유실될 수 있다. 그래서 이 경로는
 * update_event_slot_mode RPC만 호출하고, RPC가 Event row를 잠근 뒤 저장된
 * config에서 slot_mode 키 하나만 교체한다.
 *
 * club 경계는 항상 access.clubId만 신뢰한다 — body에 club_id가 섞여 와도
 * 읽지 않는다. lifecycle·전환 잠금·정규화는 전부 RPC가 최종 판정하고,
 * 여기서는 canonical string 여부만 먼저 걸러 불필요한 DB 왕복을 줄인다.
 */

const SLOT_MODES: readonly MatchSlotMode[] = ["none", "ordered", "timed"] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "운영 방식이 올바르지 않습니다." }, { status: 400 });
  }

  const { slotMode } = body as { slotMode?: unknown };
  // canonical string만 허용한다 — 공백·대소문자 변형을 보정하지 않는다.
  if (typeof slotMode !== "string" || !(SLOT_MODES as readonly string[]).includes(slotMode)) {
    return NextResponse.json({ error: "운영 방식이 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error: rpcError } = await supabase.rpc("update_event_slot_mode", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_slot_mode: slotMode,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "운영 방식 변경에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  // returns table(...) 이므로 배열로 온다.
  const row = (Array.isArray(data) ? data[0] : data) as UpdateEventSlotModeRow | undefined | null;
  if (!row) {
    console.error("[admin/events/:id/slot-mode PATCH] empty rpc result");
    return NextResponse.json({ error: "운영 방식 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    slotMode: row.slot_mode,
    schedulingConfirmedAt: row.scheduling_confirmed_at,
    changed: row.changed,
  });
}
