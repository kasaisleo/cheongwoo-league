import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/session-guests?sessionId=...
 * 특정 매치의 참석 게스트 목록 조회.
 * 공개 조회 가능 (공개 /attendance에서도 사용) — 인증 없이 열어두되,
 * guests는 anon/authenticated GRANT가 없으므로(guests P0) service-role로
 * 조회하고, sessionId로 도출한 club_id를 guest 조회에도 강제해 다른
 * 클럽 게스트가 섞이지 않게 한다. phone/notes/referred_by는 반환하지 않는다.
 *
 * Phase 3 계약 변경 없음 — POST/DELETE만 수정.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, club_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: true, sessionGuests: [] });
  }

  const { data, error } = await supabase
    .from("session_guests")
    .select("id, guest_id, guests!inner(id, name, is_active)")
    .eq("session_id", session.id)
    .eq("guests.club_id", session.club_id)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: "게스트 목록 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionGuests: data ?? [] });
}

/**
 * POST /api/admin/session-guests
 * 매치에 게스트 참석 추가.
 * 권한: manager/admin/master/owner (isAdmin)
 *
 * cross-club 방지: sessionId/guestId 둘 다 access.clubId로 검증한다 —
 * guestId만 검증하고 sessionId를 검증하지 않으면, 타 클럽 session에
 * 자기 클럽 guest를 끼워 넣을 수 있었다(task_63c8e6f0). body의 clubId는
 * 받지 않는다 — access.clubId만 신뢰한다.
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const currentClubId = access.clubId;

  const { sessionId, guestId } = await request.json() as {
    sessionId?: string;
    guestId?: string;
  };

  if (!sessionId || !guestId || !UUID_RE.test(sessionId) || !UUID_RE.test(guestId)) {
    return NextResponse.json({ error: "sessionId와 guestId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const [{ data: session, error: sessionError }, { data: guest, error: guestError }] = await Promise.all([
    supabase.from("attendance_sessions").select("id").eq("id", sessionId).eq("club_id", currentClubId).maybeSingle(),
    supabase.from("guests").select("id, name, is_active, converted_to_member_id").eq("id", guestId).eq("club_id", currentClubId).maybeSingle(),
  ]);

  if (sessionError || guestError) {
    console.error("[admin/session-guests POST]", sessionError ?? guestError);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!guest) {
    return NextResponse.json({ error: "게스트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!guest.is_active) {
    return NextResponse.json({ error: "비활성화된 게스트입니다." }, { status: 400 });
  }
  if (guest.converted_to_member_id) {
    return NextResponse.json({ error: "정회원으로 전환된 게스트입니다." }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("session_guests")
    .insert({
      session_id: sessionId,
      guest_id: guestId,
      added_by: access.memberId ?? null,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "이미 추가된 게스트입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "게스트 추가 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `${guest.name}이(가) 참석 게스트로 추가되었습니다.` });
}

/**
 * DELETE /api/admin/session-guests?id=...
 * 매치 참석 게스트 제거.
 * 권한: manager/admin/master/owner (isAdmin)
 *
 * cross-club 방지: session_guests row는 자체적으로 club을 갖지 않으므로,
 * row가 가리키는 session_id를 먼저 조회해 access.clubId 소속인지 검증한
 * 뒤에만 삭제한다. id만 알아도(다른 클럽 admin이 id를 추측/열거해도) 그
 * row가 자기 클럽 세션 소속이 아니면 삭제할 수 없다 — 404로 응답하고
 * guest/session 상세는 반환하지 않는다.
 */
export async function DELETE(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin || !access.clubId) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const currentClubId = access.clubId;

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "session_guest id가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: row, error: rowError } = await supabase
    .from("session_guests")
    .select("id, session_id")
    .eq("id", id)
    .maybeSingle();

  if (rowError) {
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("id", row.session_id)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!session) {
    // 타 클럽 세션 소속 row — id를 알아도 삭제 불가. 존재 여부를 흘리지 않는다.
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabase
    .from("session_guests")
    .delete()
    .eq("id", id)
    .eq("session_id", row.session_id);

  if (error) {
    return NextResponse.json({ error: "게스트 제거 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
