"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches, type DisplayMatch } from "@/lib/match-display";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v5 — 개인 기록 기준 통일 (관리자 기록 영역 기준 맞춤).
 *
 * 출석 체크율 = 출석 체크 수 / 완료 매치 수 (완료 매치 0이면 "-")
 * Recent Attendance = 완료 세션 기준, 세션별 중복 제거, 미응답 포함
 */

const RECENT_ATTENDANCE_LIMIT = 5;

// ── 출석 상태 (DB 값 + 미응답)
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

// ── 개인 출석 체크율: 출석 체크 수 / 완료 매치 수
function calcAttendRate(attendingCount: number, completedCount: number): string {
  if (completedCount === 0) return "-";
  return `${Math.round((attendingCount / completedCount) * 100)}%`;
}

export default function MyPage() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<DisplayMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // 출석 통계
  const [attendingCount, setAttendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [recentAttendance, setRecentAttendance] = useState<
    { sessionId: string; sessionDate: string; sessionTitle: string; status: DisplayAttendStatus }[]
  >([]);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/login?returnUrl=/mypage"); return; }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        if (typedMember) {
          const today = new Date().toISOString().slice(0, 10);

          // 완료 세션 (closed OR 날짜 지난 것, archived 제외)
          const { data: completedSessions } = await supabase
            .from("attendance_sessions")
            .select("id, title, session_date, session_day")
            .neq("status", "archived")
            .or(`status.eq.closed,session_date.lt.${today}`)
            .order("session_date", { ascending: false });

          const sessions = completedSessions ?? [];
          const completedSessionIds = sessions.map((s) => s.id);
          const cCount = completedSessionIds.length;
          setCompletedCount(cCount);

          // 이 회원의 attendance (완료 세션만)
          const { data: attendRows } = cCount > 0
            ? await supabase
                .from("attendance")
                .select("session_id, status")
                .eq("member_id", typedMember.id)
                .in("session_id", completedSessionIds)
            : { data: [] };

          // session_id → 상태 맵
          const attendMap = new Map(
            (attendRows ?? []).map((r) => [r.session_id, r.status as "attending" | "undecided" | "absent"])
          );

          // 출석 체크 수 (attending만)
          const aCount = [...attendMap.values()].filter((s) => s === "attending").length;
          setAttendingCount(aCount);

          // Recent Attendance: 최근 N개 완료 세션 기준 (미응답 포함, 세션 중복 없음)
          const recent = sessions.slice(0, RECENT_ATTENDANCE_LIMIT).map((s) => {
            const dbStatus = attendMap.get(s.id);
            const status: DisplayAttendStatus = dbStatus ?? "no_response";
            return {
              sessionId: s.id,
              sessionDate: s.session_date,
              sessionTitle: s.title,
              status,
            };
          });
          setRecentAttendance(recent);

          // 최근 경기
          const [{ data: matchRows }] = await Promise.all([
            supabase
              .from("matches")
              .select(MATCH_SELECT_WITH_PLAYERS)
              .or(
                `team_a_player1_member.eq.${typedMember.id},team_a_player2_member.eq.${typedMember.id},team_b_player1_member.eq.${typedMember.id},team_b_player2_member.eq.${typedMember.id}`
              )
              .order("played_at", { ascending: false })
              .limit(5),
          ]);
          setRecentMatches(toDisplayMatches(matchRows));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (!initialized) return null;

  if (loading) {
    return (
      <main className="px-4 pt-6">
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
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
    <main className="px-4 pt-6 pb-10">
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">My Page</p>
        <h1 className="headline-kr text-4xl text-line-900">마이페이지</h1>
      </header>

      {!member && (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-line-500">Not Linked</p>
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
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-clay-400/60">LP</p>
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
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  출석 체크율
                </p>
                {completedCount > 0 && (
                  <p className="text-[9px] text-line-400">{attendingCount}/{completedCount} 매치</p>
                )}
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {matchesPlayed}<span className="ml-0.5 text-sm font-semibold">경기</span>
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Played</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-gold">
                  {winRate}<span className="ml-0.5 text-sm font-semibold">%</span>
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Win Rate</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {member.mapo_score !== null ? member.mapo_score : "—"}
                  {member.mapo_score !== null && <span className="ml-0.5 text-sm font-semibold">점</span>}
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">Mapo Score</p>
              </div>
            </div>
          </div>

          {/* 최근 경기 */}
          {recentMatches.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Recent Matches</span>
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

          {/* 최근 출석 — 완료 세션 기준, 미응답 포함, 세션별 중복 없음 */}
          {recentAttendance.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                  Recent Attendance
                </span>
              </div>
              {recentAttendance.map((row, idx) => (
                <div key={row.sessionId}  // session_id 기준 unique key — 중복 없음
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
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Kakao</span>
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
