import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

// TODO(보안): attendance 테이블의 RLS가 현재 anon insert/update를 허용하고 있어
// 인증 없이 누구나 직접 DB에 출석을 기록할 수 있는 상태입니다.
// 이 API Route는 서버에서 Supabase Auth 세션을 검증해 "본인만 수정"을 강제하지만,
// RLS 자체가 열려있어 API를 우회한 직접 DB 접근은 막을 수 없습니다.
// 장기적으로 RLS 정책을 아래처럼 강화해야 합니다:
//   - attendance insert: auth.uid()로 members를 찾아 member_id 일치 여부 확인
//   - attendance update: 동일 조건
//   - anon 허용 정책(attendance_insert_anon, attendance_update_anon) 삭제
// 단, RLS 변경은 기존 관리자 출석 페이지(open 세션 직접 upsert)의 동작에 영향을
// 줄 수 있으므로 별도 Step에서 신중하게 진행해야 합니다.

const VALID_STATUSES: AttendanceStatus[] = ["attending", "undecided", "absent"];

interface AttendanceRequestBody {
  sessionId: string;
  status: AttendanceStatus;
}

/**
 * 로그인한 회원이 본인 출석 상태만 변경하는 API.
 * 관리자 출석 관리(app/api/attendance/admin-update)와 완전히 독립된 별도 엔드포인트.
 *
 * 인증: Supabase Auth 쿠키 세션으로 현재 user를 확인한다 — lib/admin-auth.ts와 무관.
 * 권한: members.auth_user_id = auth.user.id 인 회원의 본인 attendance만 수정 가능.
 *
 * upsert 대신 조회 → update/insert 방식 사용:
 *   attendance 테이블의 partial unique index(session_id IS NOT NULL)로 인해
 *   Supabase upsert onConflict가 불안정할 수 있어 명시적으로 분기한다.
 */
export async function POST(request: NextRequest) {
  // 1) Supabase Auth 세션 확인 (쿠키 기반, middleware와 무관)
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  // 2) body 파싱 및 검증
  let body: AttendanceRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { sessionId, status } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status 값이 올바르지 않습니다." }, { status: 400 });
  }

  // 이하 DB 조작은 service-role로 처리한다 — RLS로 anon에게 쓰기가 열려있지만,
  // 서버에서 본인 확인 후 직접 처리하는 방식이 더 명확하다.
  const admin = createServiceClient();
  const currentClubId = await getCurrentClubId();

  // 3) auth_user_id로 연결된 회원 조회
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json(
      { error: "연결된 회원 정보가 없습니다. 운영진에게 회원 연결을 요청해주세요." },
      { status: 404 }
    );
  }

  const memberId = member.id;

  // 4) 세션 조회 및 상태 검증
  const { data: session, error: sessionError } = await admin
    .from("attendance_sessions")
    .select("id, status, session_date")
    .eq("id", sessionId)
    .eq("club_id", currentClubId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  if (session.status !== "open") {
    const reason =
      session.status === "closed"
        ? "이미 마감된 세션입니다."
        : "보관된 세션은 변경할 수 없습니다.";
    return NextResponse.json({ error: reason }, { status: 403 });
  }

  // 5) 기존 attendance row 조회 (partial unique index로 인해 upsert 대신 분기 처리)
  const { data: existing } = await admin
    .from("attendance")
    .select("id")
    .eq("member_id", memberId)
    .eq("session_id", sessionId)
    .maybeSingle();

  const now = new Date().toISOString();
  let attendanceId: string | null = null;

  if (existing) {
    // 5-a) 기존 row가 있으면 UPDATE
    const { data: updated, error: updateError } = await admin
      .from("attendance")
      .update({ status, updated_at: now })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (updateError || !updated) {
      console.error("[member/attendance] update 실패:", updateError);
      return NextResponse.json({ error: "출석 상태 변경에 실패했습니다." }, { status: 500 });
    }
    attendanceId = updated.id;
  } else {
    // 5-b) 없으면 INSERT
    const { data: inserted, error: insertError } = await admin
      .from("attendance")
      .insert({
        member_id: memberId,
        session_id: sessionId,
        event_date: session.session_date,
        status,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[member/attendance] insert 실패:", insertError);
      return NextResponse.json({ error: "출석 신청에 실패했습니다." }, { status: 500 });
    }
    attendanceId = inserted.id;
  }

  return NextResponse.json({ ok: true, attendanceId, status });
}
