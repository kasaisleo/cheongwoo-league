import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { SLOT_MODE_LABEL } from "@/lib/event-engine";
import type { EventCourt, EventSession, MatchConfigV1 } from "@/lib/supabase/database.types";

/**
 * GET /api/admin/events/[id]/scheduling — 코트·세션 단일 스냅샷 조회(2A-5B).
 *
 * 코트별로 여러 번 조회하지 않고, 이 Event의 활성+비활성 코트/세션을 한 번에
 * 반환한다. 비활성 항목도 누락하지 않는다 — 비활성 코트 아래 세션의 재활성화
 * 가능 여부를 UI가 판단하려면 부모 코트의 is_active를 알아야 하기 때문(정책 5).
 * slotModeLabel/canConfirmScheduling은 표시 편의용 계산값일 뿐 권한·유효성
 * 판단에 쓰지 않는다 — 최종 방어는 항상 RPC(정책 5).
 *
 * isCancelled / isCompleted는 0058 이후의 상태 계약을 그대로 옮긴 것이다.
 * 예전에는 두 상태를 합친 locked 하나를 내려보냈지만, 0058이 Event 구조 잠금을
 * cancelled 전용으로 좁히면서(completed는 운영상 종료 표시일 뿐) 두 값을
 * 분리해야 UI가 DB보다 과하게 잠그지 않는다.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status, match_config, participants_confirmed_at, scheduling_confirmed_at")
    .eq("id", params.id)
    .eq("club_id", access.clubId)
    .maybeSingle();

  if (eventError) {
    console.error("[admin/events/:id/scheduling GET]", eventError.code, eventError.message);
    return NextResponse.json({ error: "일정을 불러오지 못했습니다." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  const [{ data: courts, error: courtsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase
      .from("event_courts")
      .select("*")
      .eq("event_id", params.id)
      .eq("club_id", access.clubId)
      .order("position", { ascending: true }),
    supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", params.id)
      .eq("club_id", access.clubId)
      .order("position", { ascending: true }),
  ]);

  if (courtsError || sessionsError) {
    console.error(
      "[admin/events/:id/scheduling GET]",
      courtsError?.code ?? sessionsError?.code,
      courtsError?.message ?? sessionsError?.message
    );
    return NextResponse.json({ error: "일정을 불러오지 못했습니다." }, { status: 500 });
  }

  const sessionsByCourt = new Map<string, EventSession[]>();
  for (const s of (sessions ?? []) as EventSession[]) {
    const list = sessionsByCourt.get(s.event_court_id) ?? [];
    list.push(s);
    sessionsByCourt.set(s.event_court_id, list);
  }

  const slotMode = (event.match_config as MatchConfigV1).slot_mode;

  return NextResponse.json({
    event: {
      id: event.id,
      status: event.status,
      participants_confirmed_at: event.participants_confirmed_at,
      scheduling_confirmed_at: event.scheduling_confirmed_at,
      slotMode,
      slotModeLabel: SLOT_MODE_LABEL[slotMode] ?? slotMode,
      isCancelled: event.status === "cancelled",
      isCompleted: event.status === "completed",
      canConfirmScheduling: event.participants_confirmed_at !== null,
    },
    courts: ((courts ?? []) as EventCourt[]).map((c) => ({
      ...c,
      sessions: sessionsByCourt.get(c.id) ?? [],
    })),
  });
}
