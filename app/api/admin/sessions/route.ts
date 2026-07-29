import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapSessionRpcError } from "@/lib/session-engine";
import type { SessionDay } from "@/lib/supabase/database.types";

/**
 * POST /api/admin/sessions
 * 관리자 전용 매치(출석 세션) 생성 API.
 *
 * 기존 /api/attendance-sessions/custom과의 차이:
 *   - sessionDay: saturday/sunday/holiday/custom 모두 허용
 *   - sessionDate: 과거 날짜도 허용 (소급 경기 기록용)
 *   - 응답: { ok, sessionId } — 클라이언트에서 자동 선택에 사용
 */

// crypto.randomUUID()가 생성하는 정확한 형식만 허용 — 느슨한 검증은 idempotency
// 인덱스에 임의 문자열이 들어가는 것을 방치하게 된다(matches route.ts와 동일 정책).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (!access.clubId) {
    return NextResponse.json({ error: "클럽 컨텍스트가 없습니다." }, { status: 403 });
  }

  const { title, sessionDate, sessionDay, requestId } = await request.json() as {
    title: string;
    sessionDate: string;
    sessionDay: SessionDay;
    requestId?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "매치명을 입력해주세요." }, { status: 400 });
  }
  if (!sessionDate) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }
  const VALID_DAYS: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];
  if (!VALID_DAYS.includes(sessionDay)) {
    return NextResponse.json({ error: "매치 타입을 선택해주세요." }, { status: 400 });
  }
  if (requestId !== undefined && !UUID_RE.test(requestId)) {
    return NextResponse.json({ error: "요청 식별자가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  // body/공개/선택된 club 컨텍스트는 절대 신뢰하지 않는다 — RPC의 p_club_id에는
  // 오직 서버가 인증 세션으로부터 확인한 access.clubId만 전달한다.
  const clubId = access.clubId;

  // create_session_with_attendance(0047) — attendance_sessions insert + 활성
  // 회원 전체 attendance insert + idempotency 처리를 단일 DB 트랜잭션으로
  // 처리한다. requestId(=p_idempotency_key)를 전달하면 동일 club 안에서 같은
  // 요청의 재시도는 새 세션을 만들지 않고 기존 session_id를 반환하거나(payload
  // 동일), SESSION_IDEMPOTENCY_CONFLICT로 실패한다(payload 다름 — 409로 매핑).
  const { data: newSessionId, error: rpcError } = await supabase.rpc("create_session_with_attendance", {
    p_club_id: clubId,
    p_session_date: sessionDate,
    p_session_day: sessionDay,
    p_title: title,
    p_idempotency_key: requestId ?? null,
  });

  if (rpcError || !newSessionId) {
    const { status, message } = mapSessionRpcError(rpcError?.message, "매치 추가에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, sessionId: newSessionId });
}
