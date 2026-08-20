import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";
import { parseParticipantProfile } from "@/lib/player-profile";

/**
 * PATCH /api/admin/events/[id]/participants/[participantId]/profile — 자동 대진용
 * snapshot 교체(0074).
 *
 * 상태 변경 라우트와 분리한 이유: 상태(pending/withdrawn/excluded)와 Profile은
 * 서로 다른 lifecycle을 갖고 허용 조건도 다르다. 한 PATCH에 섞으면 "상태만
 * 바꾸려는 요청"이 Profile을 덮어쓸지 아닐지가 body 모양에 따라 달라진다.
 *
 * 계약은 set_event_participant_profile RPC 그대로 "세 값 전체 교체"다. 세 key 가
 * 모두 있어야 하며 하나라도 빠지면 400 이다 — 생략을 자동으로 null/unspecified 로
 * 바꾸면 "그대로 두려던 값"이 조용히 지워진다. 지우려면 명시적으로 null 또는
 * unspecified 를 보낸다.
 *
 * 0075: rating 은 계약에서 빠졌다. body 에 rating 이 있어도 파서가 읽지 않으므로
 * DB/RPC 로 전달되지 않는다(무시).
 *
 * Club context는 access.clubId 하나뿐이다. body에 club_id가 들어와도 읽지 않는다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; participantId: string } }
) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = parseParticipantProfile(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: rpcError } = await supabase.rpc("set_event_participant_profile", {
    p_participant_id: params.participantId,
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_gender: parsed.value.gender,
    p_tennis_start_year: parsed.value.tennisStartYear,
    p_dominant_hand: parsed.value.dominantHand,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(
      rpcError.message,
      "참가자 정보 저장에 실패했습니다."
    );
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
