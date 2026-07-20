import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { MemberType, WinnerTeam } from "@/lib/supabase/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SESSION_IDS = 50;
const PUBLIC_CACHE_HEADERS = { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" };

/**
 * GET /api/matches/public
 *
 * 두 모드를 지원한다. 둘 다 clubId를 먼저 active club으로 검증하고,
 * service-role로만 matches/attendance_sessions를 조회한다. Public 응답에는
 * member_id/guest_id/club_id/created_by 등 raw 식별자를 포함하지 않는다 —
 * 동명이인 구분/집계는 서버 내부에서 UUID를 key로 쓰고, 응답 직전에 벗겨낸다.
 *
 * 모드 A(counts): ?clubId&mode=counts&sessionIds=a,b,c — 세션별 경기 수만.
 * 모드 B(session): ?clubId&sessionId — 해당 세션의 참석자별 승/패 집계.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const clubId = params.get("clubId");

  if (!clubId || !UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "clubId가 필요합니다." }, { status: 400 });
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
  if (!club) {
    return NextResponse.json({ error: "클럽을 찾을 수 없습니다." }, { status: 404 });
  }

  if (params.get("mode") === "counts") {
    return handleCountsMode(admin, clubId, params);
  }

  return handleSessionMode(admin, clubId, params);
}

// ── 모드 A: counts ──────────────────────────────────────────────
async function handleCountsMode(
  admin: ReturnType<typeof createServiceClient>,
  clubId: string,
  params: URLSearchParams
) {
  const sessionIdsParam = params.get("sessionIds");
  if (!sessionIdsParam) {
    return NextResponse.json({ error: "sessionIds가 필요합니다." }, { status: 400 });
  }

  const sessionIds = [...new Set(sessionIdsParam.split(",").map((s) => s.trim()).filter(Boolean))];

  if (sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionIds가 필요합니다." }, { status: 400 });
  }
  if (sessionIds.length > MAX_SESSION_IDS) {
    return NextResponse.json({ error: `sessionIds는 최대 ${MAX_SESSION_IDS}개까지 허용됩니다.` }, { status: 400 });
  }
  if (!sessionIds.every((id) => UUID_RE.test(id))) {
    return NextResponse.json({ error: "sessionIds 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { data: sessions, error: sessionsError } = await admin
    .from("attendance_sessions")
    .select("id")
    .in("id", sessionIds)
    .eq("club_id", clubId);

  if (sessionsError) {
    console.error("[matches/public:counts]", sessionsError.code, sessionsError.message);
    return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
  }

  const verifiedIds = new Set((sessions ?? []).map((s) => s.id));
  if (verifiedIds.size !== sessionIds.length) {
    // 요청한 sessionId 중 타 클럽 소속이거나 존재하지 않는 id가 섞여 있다 — 전체 요청을 거부한다.
    return NextResponse.json({ error: "일부 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: matches, error: matchesError } = await admin
    .from("matches")
    .select("session_id")
    .eq("club_id", clubId)
    .in("session_id", sessionIds);

  if (matchesError) {
    console.error("[matches/public:counts]", matchesError.code, matchesError.message);
    return NextResponse.json({ error: "경기 조회 실패" }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const id of sessionIds) counts[id] = 0;
  for (const m of matches ?? []) {
    if (m.session_id && counts[m.session_id] !== undefined) counts[m.session_id]++;
  }

  return NextResponse.json({ counts }, { headers: PUBLIC_CACHE_HEADERS });
}

// ── 모드 B: session 기록 ──────────────────────────────────────────
interface PlayerRelation {
  id: string;
  name: string;
  member_type?: MemberType;
}

interface MatchRow {
  id: string;
  played_at: string;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: WinnerTeam;
  team_a_player1_member_row: PlayerRelation | null;
  team_a_player1_guest_row: PlayerRelation | null;
  team_a_player2_member_row: PlayerRelation | null;
  team_a_player2_guest_row: PlayerRelation | null;
  team_b_player1_member_row: PlayerRelation | null;
  team_b_player1_guest_row: PlayerRelation | null;
  team_b_player2_member_row: PlayerRelation | null;
  team_b_player2_guest_row: PlayerRelation | null;
}

interface RecordAccumulator {
  displayName: string;
  isGuest: boolean;
  memberType: MemberType | null;
  wins: number;
  losses: number;
}

async function handleSessionMode(
  admin: ReturnType<typeof createServiceClient>,
  clubId: string,
  params: URLSearchParams
) {
  const sessionId = params.get("sessionId");
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const { data: session, error: sessionError } = await admin
    .from("attendance_sessions")
    .select("id, title, session_day, session_date, status")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (sessionError) {
    console.error("[matches/public:session]", sessionError.code, sessionError.message);
    return NextResponse.json({ error: "세션 조회 실패" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: matches, error: matchesError } = await admin
    .from("matches")
    .select(
      `
      id, played_at, score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team,
      team_a_player1_member_row:members!matches_team_a_player1_member_fkey(id, name, member_type),
      team_a_player1_guest_row:guests!matches_team_a_player1_guest_fkey(id, name),
      team_a_player2_member_row:members!matches_team_a_player2_member_fkey(id, name, member_type),
      team_a_player2_guest_row:guests!matches_team_a_player2_guest_fkey(id, name),
      team_b_player1_member_row:members!matches_team_b_player1_member_fkey(id, name, member_type),
      team_b_player1_guest_row:guests!matches_team_b_player1_guest_fkey(id, name),
      team_b_player2_member_row:members!matches_team_b_player2_member_fkey(id, name, member_type),
      team_b_player2_guest_row:guests!matches_team_b_player2_guest_fkey(id, name)
    `
    )
    .eq("session_id", sessionId)
    .eq("club_id", clubId);

  if (matchesError) {
    console.error("[matches/public:session]", matchesError.code, matchesError.message);
    return NextResponse.json({ error: "경기 조회 실패" }, { status: 500 });
  }

  const matchRows = (matches ?? []) as unknown as MatchRow[];

  // 서버 집계 — member/guest UUID를 namespace-분리된 key로만 내부에서 사용하고
  // 응답에는 절대 포함하지 않는다(displayName만 노출).
  const recordMap = new Map<string, RecordAccumulator>();

  function addResult(row: PlayerRelation | null, isGuest: boolean, isWin: boolean) {
    if (!row) return;
    const key = (isGuest ? "guest:" : "member:") + row.id;
    const prev = recordMap.get(key) ?? {
      displayName: row.name,
      isGuest,
      memberType: isGuest ? null : (row.member_type ?? null),
      wins: 0,
      losses: 0,
    };
    recordMap.set(key, {
      ...prev,
      wins: prev.wins + (isWin ? 1 : 0),
      losses: prev.losses + (isWin ? 0 : 1),
    });
  }

  for (const m of matchRows) {
    const aWin = m.winner_team === "A";
    addResult(m.team_a_player1_member_row, false, aWin);
    addResult(m.team_a_player1_guest_row, true, aWin);
    addResult(m.team_a_player2_member_row, false, aWin);
    addResult(m.team_a_player2_guest_row, true, aWin);
    addResult(m.team_b_player1_member_row, false, !aWin);
    addResult(m.team_b_player1_guest_row, true, !aWin);
    addResult(m.team_b_player2_member_row, false, !aWin);
    addResult(m.team_b_player2_guest_row, true, !aWin);
  }

  const records = [...recordMap.values()]
    .map((r) => {
      const games = r.wins + r.losses;
      return {
        displayName: r.displayName,
        isGuest: r.isGuest,
        memberType: r.memberType,
        wins: r.wins,
        losses: r.losses,
        games,
        winRate: games > 0 ? Math.round((r.wins / games) * 100) : 0,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aTotal = a.wins + a.losses;
      const bTotal = b.wins + b.losses;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.displayName.localeCompare(b.displayName, "ko");
    });

  return NextResponse.json(
    {
      session,
      matchCount: matchRows.length,
      records,
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}
