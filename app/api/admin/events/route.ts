import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { mapEventRpcError } from "@/lib/event-engine";

/**
 * GET  /api/admin/events        — 이 club의 Event 목록.
 * POST /api/admin/events        — create_event RPC 경유 생성.
 *
 * club context는 access.clubId만 사용한다 — selected_club_id/getCurrentClubId()
 * 사용 금지(cross-club 오염 방지). body/query로 받은 club_id는 신뢰하지 않는다.
 */
export async function GET() {
  const access = await getAdminAccessServer();
  // 읽기 전용 GET은 access.isAdmin(기존 members-list/guests-list 관례), 쓰기(POST)는
  // access.kakaoIsAdmin(기존 sessions/session-guests 관례) — 현재 값은 동일하지만
  // 저장소 관례를 그대로 따른다.
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("club_id", access.clubId)
    .order("event_date", { ascending: false });

  if (error) {
    console.error("[admin/events GET]", error.code, error.message);
    return NextResponse.json({ error: "이벤트 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { title, eventDate } = (await request.json()) as {
    title?: string;
    eventDate?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "이벤트명을 입력해주세요." }, { status: 400 });
  }
  if (!eventDate) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();
  // p_club_id/p_created_by는 서버가 세션으로부터 도출한 값만 전달 — 클라이언트가
  // 넘긴 값은 없음. p_match_config는 null로 두어 클럽 기본값(match_config_defaults)을
  // 그대로 스냅샷한다(이번 phase는 config 편집 UI가 없음).
  const { data: newEventId, error: rpcError } = await supabase.rpc("create_event", {
    p_club_id: access.clubId,
    p_title: title,
    p_event_date: eventDate,
    p_match_config: null,
    p_created_by: access.memberId,
  });

  if (rpcError || !newEventId) {
    const { status, message } = mapEventRpcError(rpcError?.message, "이벤트 생성에 실패했습니다.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, eventId: newEventId });
}
