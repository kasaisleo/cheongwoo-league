import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * GET /api/admin/session-guests?sessionId=...
 * 특정 매치의 참석 게스트 목록 조회.
 * 공개 조회 가능 (공개 /attendance에서도 사용).
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_guests")
    .select("id, guest_id, guests(id, name, phone, is_active)")
    .eq("session_id", sessionId)
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
 */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { sessionId, guestId } = await request.json() as {
    sessionId?: string;
    guestId?: string;
  };

  if (!sessionId || !guestId) {
    return NextResponse.json({ error: "sessionId와 guestId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 게스트 유효성 확인
  const { data: guest } = await supabase
    .from("guests")
    .select("id, name, is_active, converted_to_member_id")
    .eq("id", guestId)
    .eq("club_id", access.clubId ?? "")
    .maybeSingle();

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
 */
export async function DELETE(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "session_guest id가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("session_guests").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "게스트 제거 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
