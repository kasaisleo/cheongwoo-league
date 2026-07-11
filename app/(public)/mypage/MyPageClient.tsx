"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { ClubMemberLoginGate } from "@/components/member/ClubMemberLoginGate";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches, type DisplayMatch } from "@/lib/match-display";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v7 — 단일 ClubMemberLoginGate + checking state.
 *
 * 상태 흐름:
 *   authState=checking → ClubMemberLoginGate(checking) — auth 확인 중
 *   authState=unauth   → ClubMemberLoginGate(clubSlug) — 비로그인
 *   authState=authed   → data fetch → content 렌더
 *
 * - checking/unauth 모두 동일한 min-height/position → layout shift 없음
 * - public /login redirect 없음
 * - unauthenticated 상태에서 member/match/attendance API 호출 없음
 * - club skin CSS token 사용 (ClubMemberLoginGate 내부)
 */

const RECENT_ATTENDANCE_LIMIT = 5;

type AuthState = "checking" | "unauth" | "authed";
type DisplayAttendStatus = "attending" | "undecided" | "absent" | "no_response";

const STATUS_LABEL: Record<DisplayAttendStatus, string> = {
  attending: "출석",
  undecided: "미정",
  absent: "불참",
  no_response: "미응답",
};

const STATUS_TONE: Record<DisplayAttendStatus, "win" | "amber" | "loss" | "neutral"> = {
  attending: "win",
  undecided: "amber",
  absent: "loss",
  no_response: "neutral",
};

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function calcAttendRate(attendingCount: number, completedCount: number): string {
  if (completedCount === 0) return "-";
  return `${Math.round((attendingCount / completedCount) * 100)}%`;
}

export default function MyPageClient({
  currentClubId,
  slug,
}: {
  currentClubId: string;
  slug?: string;
}) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [recentMatches, setRecentMatches] = useState<DisplayMatch[]>([]);
  const [attendingCount, setAttendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [recentAttendance, setRecentAttendance] = useState<
    { sessionId: string; sessionDate: string; sessionTitle: string; status: DisplayAttendStatus }[]
  >([]);

  // ── 1. auth 확인 ──────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setAuthState("unauth");
      } else {
        setAuthUser(session.user);
        setAuthState("authed");
      }
    });
  }, []);

  // ── 2. 인증 후 데이터 fetch (authState=authed일 때만) ─────
  useEffect(() => {
    if (authState !== "authed" || !authUser) return;

    const supabase = createClient();
    setDataLoading(true);

    void (async () => {
      try {
        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", authUser.id)
          .eq("club_id", currentClubId)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        if (typedMember) {
          const today = new Date().toISOString().slice(0, 10);

          const { data: completedSessions } = await supabase
            .from("attendance_sessions")
            .select("id, title, session_date, session_day")
            .eq("club_id", currentClubId)
            .neq("status", "archived")
            .or(`status.eq.closed,session_date.lt.${today}`)
            .order("session_date", { ascending: false });

          const sessions = completedSessions ?? [];
          const completedSessionIds = sessions.map((s) => s.id);
          const cCount = completedSessionIds.length;
          setCompletedCount(cCount);

          const { data: attendRows } = cCount > 0
            ? await supabase
                .from("attendance")
                .select("session_id, status")
                .eq("member_id", typedMember.id)
                .in("session_id", completedSessionIds)
            : { data: [] };

          const attendMap = new Map(
            (attendRows ?? []).map((r) => [r.session_id, r.status as "attending" | "undecided" | "absent"])
          );
          const aCount = [...attendMap.values()].filter((s) => s === "attending").length;
          setAttendingCount(aCount);

          const recent = sessions.slice(0, RECENT_ATTENDANCE_LIMIT).map((s) => {
            const dbStatus = attendMap.get(s.id);
            const status: DisplayAttendStatus = dbStatus ?? "no_response";
            return { sessionId: s.id, sessionDate: s.session_date, sessionTitle: s.title, status };
          });
          setRecentAttendance(recent);

          const { data: matchRows } = await supabase
            .from("matches")
            .select(MATCH_SELECT_WITH_PLAYERS)
            .or(
              `team_a_player1_member.eq.${typedMember.id},team_a_player2_member.eq.${typedMember.id},team_b_player1_member.eq.${typedMember.id},team_b_player2_member.eq.${typedMember.id}`
            )
            .order("played_at", { ascending: false })
            .limit(5);
          setRecentMatches(toDisplayMatches(matchRows));
        }
      } finally {
        setDataLoading(false);
      }
    })();
  }, [authState, authUser, currentClubId]);

  // ── 렌더 분기 ─────────────────────────────────────────────

  if (authState === "checking") {
    return <ClubMemberLoginGate checking />;
  }

  if (authState === "unauth") {
    return <ClubMemberLoginGate clubSlug={slug} />;
  }

  // authState === "authed"
  if (dataLoading) {
    return (
      <main className="px-4 pt-6 pb-28">
        <header className="mb-5">
          <p className="eyebrow-en text-clay-400">My Page</p>
          <h1 className="headline-kr text-4xl text-line-900">마이페이지</h1>
        </header>
        <p className="text-center text-sm text-line-400 pt-8">불러오는 중...</p>
      </main>
    );
  }

  const kakaoNickname =
    (authUser?.user_metadata?.name as string | undefined) ??
    (authUser?.user_metadata?.full_name as string | undefined) ??
    (authUser?.user_metadata?.preferred_username as string | undefined) ??
    null;
  const kakaoEmail = authUser?.email ?? null;
  const matchesPlayed = member ? member.wins + member.losses : 0;
  const winRate = matchesPlayed > 0 ? Math.round((member!.wins / matchesPlayed) * 100) : 0;
  const attendRateDisplay = calcAttendRate(attendingCount, completedCount);

  return (
    <main className="px-4 pt-6 pb-28">
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">My Page</p>
        <h1 className="headline-kr text-4xl text-line-900">마이페이지</h1>
      </header>

      {!member && (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="eyebrow-en text-line-500">Not Linked</p>
          <p className="mt-1 text-xs text-line-400">운영진에게 회원 연결을 요청해주세요.</p>
        </div>
      )}

      {member && (
        <div className="space-y-3">

          {/* Hero Block */}
          <div className="relative overflow-hidden rounded-[14px] border border-clay-400/30 bg-line-50">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-clay-400/60" />
            <div className="px-5 py-4 pl-7">
              <div className="mb-2 flex items-center gap-2">
                <p className="name-kr text-line-900">{member.name}</p>
                <span className="rounded-sm bg-line-200 px-2 py-0.5 text-[10px] font-semibold text-line-600">
                  {member.member_type}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-xs">
                  <span className="font-semibold text-gold">{member.wins}W</span>
                  <span className="mx-1 text-line-400">·</span>
                  <span className="text-line-500">{member.losses}L</span>
                  <span className="mx-1.5 text-line-300">|</span>
                  <span className="text-line-500">{winRate}% Win Rate</span>
                </p>
                <div className="shrink-0 text-right">
                  <p className="font-score text-3xl font-bold tabular-nums text-clay-400">{member.league_point}</p>
                  <p className="eyebrow-en text-[9px] text-clay-400/60">LP</p>
                </div>
              </div>
            </div>
          </div>

          {/* 통계 */}
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {attendRateDisplay === "-"
                    ? <span className="text-line-400">-</span>
                    : <>{attendRateDisplay.replace("%", "")}<span className="ml-0.5 text-sm font-semibold">%</span></>
                  }
                </p>
                <p className="text-[9px] font-semibold text-line-500">출석 체크율</p>
                {completedCount > 0 && (
                  <p className="text-[9px] text-line-400">{attendingCount}/{completedCount} 매치</p>
                )}
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {matchesPlayed}<span className="ml-0.5 text-sm font-semibold">경기</span>
                </p>
                <p className="eyebrow-en text-[9px] text-line-500">Played</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-gold">
                  {winRate}<span className="ml-0.5 text-sm font-semibold">%</span>
                </p>
                <p className="eyebrow-en text-[9px] text-line-500">Win Rate</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {member.mapo_score !== null ? member.mapo_score : "—"}
                  {member.mapo_score !== null && <span className="ml-0.5 text-sm font-semibold">점</span>}
                </p>
                <p className="text-[9px] font-semibold text-line-500">지역점수</p>
              </div>
            </div>
          </div>

          {/* 최근 경기 */}
          {recentMatches.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="eyebrow-en text-[10px] text-line-500">Recent Matches</span>
              </div>
              {recentMatches.map((match, idx) => {
                const myTeamIsA = match.teamAPlayer1.name === member.name || match.teamAPlayer2.name === member.name;
                const iWon = (myTeamIsA && match.winner_team === "A") || (!myTeamIsA && match.winner_team === "B");
                const myScore = myTeamIsA ? match.score_a : match.score_b;
                const oppScore = myTeamIsA ? match.score_b : match.score_a;
                const partners = myTeamIsA
                  ? [match.teamAPlayer1, match.teamAPlayer2].filter(p => p.name !== member.name)
                  : [match.teamBPlayer1, match.teamBPlayer2].filter(p => p.name !== member.name);
                return (
                  <div key={match.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${idx < recentMatches.length - 1 ? "border-b border-line-200/30" : ""}`}>
                    <ResultBadge result={iWon ? "win" : "loss"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-line-800">
                        {partners.map(p => p.name).join(" · ") || "—"}
                      </p>
                      <p className="text-[10px] text-line-500">{match.played_at}</p>
                    </div>
                    <span className="shrink-0 font-score text-sm font-bold tabular-nums text-line-700">
                      {myScore} : {oppScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 최근 출석 */}
          {recentAttendance.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="eyebrow-en text-[10px] text-line-500">Recent Attendance</span>
              </div>
              {recentAttendance.map((row, idx) => (
                <div key={row.sessionId}
                  className={`flex items-center justify-between px-4 py-2.5 ${idx < recentAttendance.length - 1 ? "border-b border-line-200/30" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-score text-xs tabular-nums text-line-500">
                      {formatDate(row.sessionDate)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* 카카오 연동 */}
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
              <span className="eyebrow-en text-[10px] text-line-500">Kakao</span>
            </div>
            <div className="divide-y divide-line-200/30">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-line-500">닉네임</span>
                <span className="text-xs font-medium text-line-800">{kakaoNickname ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-line-500">이메일</span>
                <span className="text-xs font-medium text-line-800">{kakaoEmail ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-line-500">연동 상태</span>
                <Badge tone="clay">연동 완료</Badge>
              </div>
            </div>
          </div>

        </div>
      )}
    </main>
  );
}
