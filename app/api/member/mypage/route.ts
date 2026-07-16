import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchMemberRecentMatches } from "@/lib/member-activity";

/**
 * 로그인한 회원 본인의 마이페이지 데이터 조회 API.
 *
 * members/member_stats는 anon/authenticated GRANT가 회수되어(0037) MyPageClient가
 * 브라우저에서 직접 조회할 수 없다. 이 라우트가 서버(service-role)에서 대신 조회해
 * 화면에 필요한 최소 DTO만 반환한다.
 *
 * 인증: Supabase Auth 쿠키 세션으로 현재 user를 확인한다.
 * 권한: members.auth_user_id = auth user + club_id 조합으로 본인 소속 회원만 조회.
 * clubId는 요청자가 보고 있는 club 페이지(이미 slug로 검증됨)를 가리킬 뿐이며,
 * 실제 신원 경계는 auth.getUser()로 검증된 user.id가 담당한다 — 다른 클럽의 clubId를
 * 넘겨도 그 클럽에 본인 소속 회원이 없으면 member: null만 반환된다(교차 클럽 노출 없음).
 */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createServiceClient();

  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, name, member_type, wins, losses, league_point, mapo_score")
    .eq("auth_user_id", user.id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (memberError) {
    console.error("[member/mypage] member 조회 실패:", memberError.code, memberError.message);
    return NextResponse.json({ error: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  if (!member) {
    return NextResponse.json({ member: null });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: completedSessions, error: sessionsError } = await admin
    .from("attendance_sessions")
    .select("id, title, session_date, session_day")
    .eq("club_id", clubId)
    .neq("status", "archived")
    .or(`status.eq.closed,session_date.lt.${today}`)
    .order("session_date", { ascending: false });

  if (sessionsError) {
    console.error("[member/mypage] sessions 조회 실패:", sessionsError.code, sessionsError.message);
  }

  const sessions = completedSessions ?? [];
  const completedSessionIds = sessions.map((s) => s.id);
  const completedCount = completedSessionIds.length;

  const { data: attendRows, error: attendError } =
    completedCount > 0
      ? await admin
          .from("attendance")
          .select("session_id, status")
          .eq("member_id", member.id)
          .in("session_id", completedSessionIds)
      : { data: [] as { session_id: string; status: string }[], error: null };

  if (attendError) {
    console.error("[member/mypage] attendance 조회 실패:", attendError.code, attendError.message);
  }

  const attendMap = new Map((attendRows ?? []).map((r) => [r.session_id, r.status]));
  const attendingCount = [...attendMap.values()].filter((s) => s === "attending").length;

  const recentAttendance = sessions.slice(0, 5).map((s) => ({
    sessionId: s.id,
    sessionDate: s.session_date,
    sessionTitle: s.title,
    status: attendMap.get(s.id) ?? "no_response",
  }));

  const matchSummaries = await fetchMemberRecentMatches(member.id, clubId, 5);
  const recentMatches = matchSummaries.map((m) => ({
    id: m.match.id,
    playedAt: m.match.played_at,
    won: m.won,
    myScore: m.myScore,
    opponentScore: m.opponentScore,
    partnerName: m.partner?.name ?? null,
  }));

  return NextResponse.json({
    member: {
      name: member.name,
      memberType: member.member_type,
      wins: member.wins,
      losses: member.losses,
      leaguePoint: member.league_point,
      mapoScore: member.mapo_score,
    },
    attendingCount,
    completedCount,
    recentAttendance,
    recentMatches,
  });
}
