import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import type { ParticipantStatus } from "@/lib/supabase/database.types";

/**
 * PATCH /api/admin/events/[id]/participants/[participantId] — 상태 변경.
 *
 * Phase 2A-4A 범위: pending/withdrawn/excluded만 이 라우트로 다룬다.
 * "confirmed"로의 수동 전환은 이번 phase에 포함하지 않는다 — 참가자 확정은
 * roster 단위 액션인 confirm_event_participants RPC(2A-4B)의 몫이며, 이
 * 라우트로 개별 행을 confirmed로 바꾸는 건 그 경계를 흐리므로 의도적으로
 * 막는다. excluded → pending("제외 해제")은 관리자의 명시적 액션으로만
 * 허용되고, add-participant 플로우(create_event_participant)가 자동으로
 * 되살리지 않는다는 원칙과 분리된 별도 경로다.
 */
const ALLOWED_STATUSES: ParticipantStatus[] = ["pending", "withdrawn", "excluded"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; participantId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { status } = (await request.json()) as { status?: ParticipantStatus };

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "허용되지 않는 참가자 상태입니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("update_event_participant", {
    p_participant_id: params.participantId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_status: status,
  });

  if (rpcError) {
    const { status: httpStatus, message } = mapEventRpcError(rpcError.message, "참가자 상태 변경에 실패했습니다.");
    return NextResponse.json({ error: message }, { status: httpStatus });
  }

  return NextResponse.json({ ok: true });
}
