import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/supabase/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/attendance/roster?clubId=<uuid>&sessionId=<uuid, optional>
 *
 * sessionId 없음: 기존 계약 그대로 — 활동 회원 목록만(id/name/nickname/district/member_type).
 * sessionId 있음: 해당 세션의 출석 상태를 포함한 명단 + 집계 + 로그인 사용자 본인 상태.
 *
 * members는 anon/authenticated GRANT가 회수되어(0037) 브라우저에서 직접
 * 조회할 수 없다 — service-role로 조회하되 clubId로 스코프한다.
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!clubId || !UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const admin = createServiceClient();

  // ── 기존 계약 (sessionId 없음) — 응답 shape 변경 금지 ──
  if (!sessionId) {
    const { data, error } = await admin
      .from("members")
      .select("id, name, nickname, district, member_type")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .eq("is_dormant", false)
      .order("nickname");

    if (error) {
      console.error("[attendance/roster]", error.code, error.message);
      return NextResponse.json({ error: "명단을 불러오지 못했습니다." }, { status: 500 });
    }
    return NextResponse.json({ members: data ?? [] });
  }

  // ── 확장 계약 (sessionId 있음) ──
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "sessionId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // session→club 검증 (attendance에는 club_id가 없으므로 session을 통해서만 스코프할 수 있다)
  const { data: session, error: sessionError } = await admin
    .from("attendance_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (sessionError) {
    console.error("[attendance/roster]", sessionError.code, sessionError.message);
    return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: members, error: membersError } = await admin
    .from("members")
    .select("id, name, nickname, district, member_type")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .eq("is_dormant", false)
    .order("nickname");

  if (membersError) {
    console.error("[attendance/roster]", membersError.code, membersError.message);
    return NextResponse.json({ error: "명단을 불러오지 못했습니다." }, { status: 500 });
  }

  const memberList = members ?? [];

  // club invariant 검증용 — 이 클럽에 속한 모든 member_id(활동/휴면/비활성 무관).
  // attendance에 club_id가 없어 FK만으로는 club 일치가 보장되지 않으므로, "이 클럽
  // 소속인지"는 이 집합으로만 판단한다. 명단 표시(memberList)는 활동회원만으로 좁히지만,
  // counts 집계는 좁히지 않는다 — 휴면/비활성 회원의 과거 attendance row도 실제로
  // 존재하는 응답이면 집계에 포함해야 HomeAttendanceSection의 기존 raw 집계와 일치한다.
  const { data: allClubMembers, error: allMembersError } = await admin
    .from("members")
    .select("id")
    .eq("club_id", clubId);

  if (allMembersError) {
    console.error("[attendance/roster]", allMembersError.code, allMembersError.message);
    return NextResponse.json({ error: "명단을 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: attendanceRows, error: attendanceError } = await admin
    .from("attendance")
    .select("member_id, status")
    .eq("session_id", sessionId);

  if (attendanceError) {
    console.error("[attendance/roster]", attendanceError.code, attendanceError.message);
    return NextResponse.json({ error: "출석 현황을 불러오지 못했습니다." }, { status: 500 });
  }

  const clubMemberIdSet = new Set((allClubMembers ?? []).map((m) => m.id));
  const clubStatusByMember = new Map<string, AttendanceStatus>(
    (attendanceRows ?? [])
      .filter((a) => clubMemberIdSet.has(a.member_id))
      .map((a) => [a.member_id, a.status as AttendanceStatus])
  );

  // 명단 표시용 — 활동회원(memberList)만 대상으로, 위 clubStatusByMember에서 조회한다.
  const membersWithStatus = memberList.map((m) => ({
    ...m,
    // 기본 상태는 미정(undecided) — 기존 Client 로직과 동일한 기본값
    status: clubStatusByMember.get(m.id) ?? ("undecided" as AttendanceStatus),
    // 실제 attendance row 존재 여부 — "무응답을 undecided로 기본 표시"와
    // "실제로 undecided를 선택함"을 구분해야 하는 소비처(NewMatchPageClient 등)를 위한 필드.
    responded: clubStatusByMember.has(m.id),
  }));

  // counts는 활동회원 제한 없이, 이 클럽 소속 member_id의 실제 attendance row 전체를
  // 집계한다 — HomeAttendanceSection의 기존 직접 조회(무응답 회원은 어느 count에도
  // 안 들어감, 휴면/비활성 회원의 과거 row도 그대로 집계됨)와 diff 0으로 일치시킨다.
  const counts = { attending: 0, undecided: 0, absent: 0 };
  for (const status of clubStatusByMember.values()) counts[status]++;

  // 로그인 사용자 본인 상태 — auth_user_id + club_id로 서버에서 도출.
  // 미로그인/미연결이면 null. 응답이 회원마다 달라지므로 캐시 금지.
  let selfStatus: AttendanceStatus | null = null;
  const { data: { user } } = await createClient().auth.getUser();

  if (user) {
    const { data: selfMember } = await admin
      .from("members")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (selfMember) {
      const { data: selfAttendance } = await admin
        .from("attendance")
        .select("status")
        .eq("member_id", selfMember.id)
        .eq("session_id", sessionId)
        .maybeSingle();
      selfStatus = (selfAttendance?.status as AttendanceStatus | undefined) ?? null;
    }
  }

  return NextResponse.json(
    { members: membersWithStatus, counts, selfStatus },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
