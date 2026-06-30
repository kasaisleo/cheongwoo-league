"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches, type DisplayMatch } from "@/lib/match-display";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats, AttendanceStatus } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v4 — 내 회원 정보 확인 중심.
 *
 * Step 14-4: "신청 가능한 일정" 출석 신청 섹션 제거.
 * 출석 신청은 홈(HomeAttendanceSection)과 /attendance에서만 담당한다.
 *
 * 섹션 구성:
 *   1. 회원 정보
 *   2. 카카오 연동
 *   3. 활동 통계
 *   4. 최근 출석 이력
 *
 * 인증:
 *   - 미로그인 → /login 이동
 *   - 로그인 됐지만 members.auth_user_id 미연결 → 안내 문구 표시
 */

const RECENT_ATTENDANCE_LIMIT = 5;

interface AttendanceRow {
  status: AttendanceStatus;
  event_date: string;
}

interface AttendanceData {
  totalResponses: number;
  attendingCount: number;
  attendanceRate: number;
  recent: AttendanceRow[];
}

function buildAttendanceData(rows: AttendanceRow[]): AttendanceData {
  const totalResponses = rows.length;
  const attendingCount = rows.filter((r) => r.status === "attending").length;
  const attendanceRate =
    totalResponses > 0 ? Math.round((attendingCount / totalResponses) * 100) : 0;
  const recent = rows.slice(0, RECENT_ATTENDANCE_LIMIT);
  return { totalResponses, attendingCount, attendanceRate, recent };
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

const STATUS_TONE: Record<AttendanceStatus, "win" | "amber" | "loss" | "neutral"> = {
  attending: "win",
  undecided: "amber",
  absent: "loss",
};

export default function MyPage() {
  const router = useRouter();
  // initialized: 세션 확인 전 null 반환으로 MemberAuthBar 높이만큼 화면이 점프하는 것 방지
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [recentMatches, setRecentMatches] = useState<DisplayMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        // 1) 세션 확인 — 미로그인이면 /login으로 이동
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        // 2) member_stats 조회 (auth_user_id 기준)
        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        // 3) 출석 통계 + 최근 이력 조회
        if (typedMember) {
          const [{ data: rows }, { data: matchRows }] = await Promise.all([
            supabase
              .from("attendance")
              .select("status, event_date")
              .eq("member_id", typedMember.id)
              .order("event_date", { ascending: false }),
            // 4) 최근 경기 조회 — 내가 참여한 경기 5건
            supabase
              .from("matches")
              .select(MATCH_SELECT_WITH_PLAYERS)
              .or(
                `team_a_player1_member.eq.${typedMember.id},team_a_player2_member.eq.${typedMember.id},team_b_player1_member.eq.${typedMember.id},team_b_player2_member.eq.${typedMember.id}`
              )
              .order("played_at", { ascending: false })
              .limit(5),
          ]);

          setAttendanceData(buildAttendanceData((rows ?? []) as AttendanceRow[]));
          setRecentMatches(toDisplayMatches(matchRows));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // 세션 확인 전 — null 반환으로 레이아웃 점프 방지
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
  const winRate =
    matchesPlayed > 0 ? Math.round((member!.wins / matchesPlayed) * 100) : 0;

  return (
    <main className="px-4 pt-6 pb-10">
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">My Page</p>
        <h1 className="headline-kr text-4xl text-line-900">마이페이지</h1>
      </header>

      {/* 회원 미연결 상태 */}
      {!member && (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-line-500">
            Not Linked
          </p>
          <p className="mt-1 text-xs text-line-400">운영진에게 회원 연결을 요청해주세요.</p>
        </div>
      )}

      {member && (
        <div className="space-y-3">

          {/* ── Player Hero Block — Ranking Champion 문법 ── */}
          <div className="relative overflow-hidden rounded-[14px] border border-clay-400/30 bg-line-50">
            {/* clay accent bar */}
            <div className="absolute left-0 top-0 h-full w-1.5 bg-clay-400/60" />
            <div className="px-5 py-4 pl-7">
              {/* 이름 + 회원 유형 */}
              <div className="mb-2 flex items-center gap-2">
                <p className="font-display text-2xl font-bold tracking-tight text-line-900">
                  {member.name}
                </p>
                <span className="rounded-sm bg-line-200 px-2 py-0.5 text-[10px] font-semibold text-line-600">
                  {member.member_type}
                </span>
              </div>
              {/* 전적 + LP */}
              <div className="flex items-end justify-between gap-3">
                <p className="text-xs">
                  <span className="font-semibold text-gold">{member.wins}W</span>
                  <span className="mx-1 text-line-400">·</span>
                  <span className="text-line-500">{member.losses}L</span>
                  <span className="mx-1.5 text-line-300">|</span>
                  <span className="text-line-500">{winRate}% Win Rate</span>
                </p>
                <div className="shrink-0 text-right">
                  <p className="font-score text-3xl font-bold tabular-nums text-clay-400">
                    {member.league_point}
                  </p>
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-clay-400/60">
                    LP
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 통계 — 간결한 2×2 grid ── */}
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {attendanceData ? attendanceData.attendanceRate : 0}
                  <span className="ml-0.5 text-sm font-semibold">%</span>
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  Attendance
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {matchesPlayed}
                  <span className="ml-0.5 text-sm font-semibold">경기</span>
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  Played
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-win">
                  {winRate}
                  <span className="ml-0.5 text-sm font-semibold">%</span>
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  Win Rate
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="font-score text-2xl font-bold tabular-nums text-line-900">
                  {member.mapo_score !== null ? member.mapo_score : "—"}
                  {member.mapo_score !== null && (
                    <span className="ml-0.5 text-sm font-semibold">점</span>
                  )}
                </p>
                <p className="font-display text-[9px] font-bold uppercase tracking-widest text-line-500">
                  Mapo Score
                </p>
              </div>
            </div>
          </div>

          {/* ── Recent Activity — 최근 경기 (Ranking Table 행 문법) ── */}
          {recentMatches.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                  Recent Matches
                </span>
              </div>
              {recentMatches.map((match, idx) => {
                const isLast = idx === recentMatches.length - 1;
                // 내가 어느 팀인지 파악 (member.id로 비교 불가 — name으로 근사)
                // winner_team A/B를 기반으로 내 팀 찾기
                const myTeamIsA =
                  match.teamAPlayer1.name === member.name ||
                  match.teamAPlayer2.name === member.name;
                const iWon =
                  (myTeamIsA && match.winner_team === "A") ||
                  (!myTeamIsA && match.winner_team === "B");
                const myScore = myTeamIsA ? match.score_a : match.score_b;
                const oppScore = myTeamIsA ? match.score_b : match.score_a;
                const partners = myTeamIsA
                  ? [match.teamAPlayer1, match.teamAPlayer2].filter(p => p.name !== member.name)
                  : [match.teamBPlayer1, match.teamBPlayer2].filter(p => p.name !== member.name);

                return (
                  <div
                    key={match.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      isLast ? "" : "border-b border-line-200/30"
                    }`}
                  >
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

          {/* ── 최근 출석 — Ranking Table 행 문법 ── */}
          {attendanceData && attendanceData.recent.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                  Recent Attendance
                </span>
              </div>
              {attendanceData.recent.map((row, idx) => {
                const isLast = idx === attendanceData.recent.length - 1;
                return (
                  <div
                    key={row.event_date}
                    className={`flex items-center justify-between px-4 py-2.5 ${
                      isLast ? "" : "border-b border-line-200/30"
                    }`}
                  >
                    <span className="font-score text-xs tabular-nums text-line-500">
                      {formatDate(row.event_date)}
                    </span>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 카카오 연동 (보조 정보, 하단) ── */}
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="border-b border-line-200/40 bg-line-100/40 px-4 py-2">
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                Kakao
              </span>
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
                <Badge tone="win">연동 완료</Badge>
              </div>
            </div>
          </div>

        </div>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-line-500">
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-line-500">{label}</span>
      {children ?? <span className="text-sm font-medium text-line-900">{value}</span>}
    </div>
  );
}

function KpiBox({
  label,
  number,
  unit,
  sub,
  tone,
  displayValue,
}: {
  label: string;
  number: number;
  unit: string;
  sub?: string;
  tone?: "win" | "loss" | "muted";
  displayValue?: string;
}) {
  const numColor =
    tone === "win"
      ? "text-win"
      : tone === "loss"
        ? "text-loss"
        : tone === "muted"
          ? "text-line-400"
          : "text-line-900";

  return (
    <div className="rounded-lg border border-line-200 bg-line-50 p-3 text-center">
      {displayValue !== undefined ? (
        <p className={`text-4xl font-extrabold leading-none ${numColor}`}>{displayValue}</p>
      ) : (
        <p className={`leading-none ${numColor}`}>
          <span className="text-4xl font-extrabold">{number}</span>
          <span className="ml-0.5 text-base font-semibold">{unit}</span>
        </p>
      )}
      <p className="mt-1.5 text-xs text-line-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-line-400">{sub}</p>}
    </div>
  );
}
