import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { SessionStatus } from "@/lib/supabase/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES: SessionStatus[] = ["open", "closed", "archived"];
const DEFAULT_STATUSES: SessionStatus[] = ["open", "closed"];

/**
 * GET /api/attendance/public-sessions
 *
 * attendance_sessions는 anon/authenticated select 정책(attendance_sessions_select_all)이
 * 열려 있지만, Client 컴포넌트의 직접 브라우저 조회를 서버 API로 대체해
 * fetchActiveSessions 등 여러 호출부를 하나의 계약으로 통일한다.
 * 최소 projection만 반환한다 — created_by/created_at/closed_at/club_id는 포함하지 않는다.
 *
 * 목록 모드: clubId + (statuses, order)
 * 단건 모드: clubId + sessionId — statuses/order와 동시 사용 불가(400).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const clubId = params.get("clubId");
  const sessionId = params.get("sessionId");
  const statusesParam = params.get("statuses");
  const orderParam = params.get("order");

  if (!clubId || !UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  if (sessionId && (statusesParam || orderParam)) {
    return NextResponse.json(
      { error: "sessionId는 statuses/order와 함께 사용할 수 없습니다." },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("status", "active")
    .maybeSingle();

  if (clubError) {
    return NextResponse.json({ error: "클럽 조회 실패" }, { status: 500 });
  }

  // ── 단건 모드 ─────────────────────────────────────────────
  if (sessionId) {
    if (!UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: "sessionId 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (!club) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: session, error } = await admin
      .from("attendance_sessions")
      .select("id, session_date, session_day, title, status")
      .eq("id", sessionId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (error) {
      console.error("[attendance/public-sessions]", error.code, error.message);
      return NextResponse.json({ error: "세션을 불러오지 못했습니다." }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ session });
  }

  // ── 목록 모드 ─────────────────────────────────────────────
  if (!club) {
    return NextResponse.json({ sessions: [] });
  }

  const statuses = statusesParam
    ? statusesParam.split(",").map((s) => s.trim())
    : DEFAULT_STATUSES;

  if (!statuses.every((s): s is SessionStatus => VALID_STATUSES.includes(s as SessionStatus))) {
    return NextResponse.json({ error: "statuses 값이 올바르지 않습니다." }, { status: 400 });
  }

  const ascending = orderParam !== "desc";
  if (orderParam && orderParam !== "asc" && orderParam !== "desc") {
    return NextResponse.json({ error: "order 값이 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("attendance_sessions")
    .select("id, session_date, session_day, title, status")
    .eq("club_id", clubId)
    .in("status", statuses)
    .order("session_date", { ascending });

  if (error) {
    console.error("[attendance/public-sessions]", error.code, error.message);
    return NextResponse.json({ error: "세션 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { sessions: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } }
  );
}
