import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import type { EventStatus } from "@/lib/supabase/database.types";

const VALID_STATUSES: EventStatus[] = ["draft", "active", "completed", "cancelled"];

/**
 * GET   /api/admin/events/[id] — 단독 id 조회 금지, 항상 club_id도 같이 검증.
 * PATCH /api/admin/events/[id] — update_event RPC 경유 수정.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  // 읽기 전용 GET은 access.isAdmin(기존 members-list/guests-list 관례).
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  // id만으로 조회하지 않는다 — club_id를 항상 같이 걸어 다른 club의 존재 여부도 흘리지 않는다.
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.id)
    .eq("club_id", access.clubId)
    .maybeSingle();

  if (error) {
    console.error("[admin/events/:id GET]", error.code, error.message);
    return NextResponse.json({ error: "이벤트를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { title, eventDate, status } = (await request.json()) as {
    title?: string;
    eventDate?: string;
    status?: EventStatus;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "허용되지 않는 상태 값입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  // p_event_id + p_club_id 조합으로만 RPC가 행을 찾는다(RPC 내부 WHERE) — 다른
  // club의 event id를 넣어도 EVENT_NOT_FOUND로만 응답, 존재 여부를 흘리지 않는다.
  const { error: rpcError } = await supabase.rpc("update_event", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_title: title ?? null,
    p_event_date: eventDate ?? null,
    p_status: status ?? null,
    p_match_config: null,
  });

  if (rpcError) {
    const { status: httpStatus, message } = mapEventRpcError(rpcError.message, "이벤트 수정에 실패했습니다.");
    return NextResponse.json({ error: message }, { status: httpStatus });
  }

  return NextResponse.json({ ok: true });
}
