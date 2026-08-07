import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import type { ParticipantStatus } from "@/lib/supabase/database.types";

const VALID_STATUSES: ParticipantStatus[] = ["pending", "confirmed", "withdrawn", "excluded"];

/**
 * GET  /api/admin/events/[id]/participants — roster 조회.
 * POST /api/admin/events/[id]/participants — 수동 member/guest 추가
 *   (create_event_participant RPC 경유 — 직접 INSERT 금지).
 *
 * [id]만으로 event_participants를 조회하지 않는다 — 먼저 event가 이 club
 * 소속인지 확인(없으면 404)한 뒤, participants 쿼리에도 event_id+club_id를
 * 같이 건다(이중 방어).
 */
async function assertEventInClub(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  clubId: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .eq("club_id", clubId)
    .maybeSingle();
  return event;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  // 읽기 전용 GET은 access.isAdmin(기존 members-list/guests-list 관례).
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const event = await assertEventInClub(supabase, params.id, access.clubId);
  if (!event) {
    return NextResponse.json({ error: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const statusFilter = statusParam
    ? (statusParam.split(",").filter((s): s is ParticipantStatus =>
        VALID_STATUSES.includes(s as ParticipantStatus)
      ) as ParticipantStatus[])
    : null;

  let query = supabase
    .from("event_participants")
    .select("*")
    .eq("event_id", params.id)
    .eq("club_id", access.clubId)
    .order("created_at", { ascending: true });

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/events/:id/participants GET]", error.code, error.message);
    return NextResponse.json({ error: "참가자 명단을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ participants: data ?? [], eventStatus: event.status });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { memberId, guestId } = (await request.json()) as {
    memberId?: string | null;
    guestId?: string | null;
  };

  if ((!!memberId) === (!!guestId)) {
    return NextResponse.json({ error: "회원 또는 게스트 중 하나만 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: participantId, error: rpcError } = await supabase.rpc("create_event_participant", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_member_id: memberId ?? null,
    p_guest_id: guestId ?? null,
  });

  if (rpcError || !participantId) {
    const { status, message } = mapEventRpcError(rpcError?.message, "참가자 추가에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, participantId });
}
