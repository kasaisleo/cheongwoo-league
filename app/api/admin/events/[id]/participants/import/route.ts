import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";

/**
 * POST /api/admin/events/[id]/participants/import
 *
 * import_event_participants_from_attendance RPC 경유(2A-4B). 6개 counter는
 * RPC가 반환한 값을 그대로 전달한다 — 여기서 재계산/가공하지 않는다.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { attendanceSessionId } = (await request.json()) as { attendanceSessionId?: string };
  if (!attendanceSessionId) {
    return NextResponse.json({ error: "출석 세션을 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error: rpcError } = await supabase.rpc("import_event_participants_from_attendance", {
    p_event_id: params.id,
    p_club_id: access.clubId,
    p_attendance_session_id: attendanceSessionId,
  });

  if (rpcError) {
    const { status, message } = mapEventRpcError(rpcError.message, "출석 명단 가져오기에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  // RETURNS TABLE — 항상 정확히 1행.
  const result = data?.[0];
  if (!result) {
    return NextResponse.json({ error: "출석 명단 가져오기에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
