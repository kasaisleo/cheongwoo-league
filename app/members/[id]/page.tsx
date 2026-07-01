import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MemberDetailActions } from "@/components/member/MemberDetailActions";
import { BackButton } from "@/components/member/BackButton";
import { CallButton } from "@/components/member/CallButton";
import { MemberTimelineSection } from "@/components/member/MemberTimelineSection";
import { MemberStatusSection } from "@/components/member/MemberStatusSection";
import { MemberHighlightCareer } from "@/components/member/MemberHighlightCareer";
import { MemberCareerProvider } from "@/components/member/MemberCareerProvider";
import { isAdminSession } from "@/lib/admin-auth";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { playerBackgroundLabel } from "@/lib/constants/member-timeline";
import {
  fetchMemberRecentMatches,
  fetchMemberRecentAttendance,
  fetchMemberAttendanceRate,
  fetchMemberRecentPointHistory,
  fetchMemberRecentPartners,
  pointHistoryReasonLabel,
  groupPointHistoryByMatch,
} from "@/lib/member-activity";
import { notFound } from "next/navigation";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface MemberDetailPageProps {
  params: { id: string };
}

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  attending: "출석",
  absent: "불참",
  undecided: "미정",
};

const SESSION_STATUS_LABEL: Record<string, string> = {
  open: "진행중",
  closed: "확정",
  archived: "보관됨",
};

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const supabase = createClient();

  const { data: member } = await supabase
    .from("member_stats")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!member) {
    notFound();
  }

  const typedMember = member as MemberWithStats;
  const matchesPlayed = typedMember.wins + typedMember.losses;
  const { getAdminAccessServer } = await import("@/lib/admin-permissions");
  const access = await getAdminAccessServer();
  const isAdmin = access.isAdmin;

  // 회원 상세의 "최근 활동" 데이터는 모두 이 회원 한 명 기준으로 독립적으로 조회한다.
  // 4개 쿼리를 병렬로 실행 — 서로 의존성이 없으므로 동시에 보내도 안전하다.
  const [recentMatches, recentAttendance, attendanceRate, recentPointHistory, recentPartners] =
    await Promise.all([
      fetchMemberRecentMatches(typedMember.id),
      fetchMemberRecentAttendance(typedMember.id),
      fetchMemberAttendanceRate(typedMember.id),
      fetchMemberRecentPointHistory(typedMember.id),
      fetchMemberRecentPartners(typedMember.id),
    ]);

  return (
    <MemberCareerProvider memberId={typedMember.id} isAdmin={isAdmin}>
      <main className="px-4 pt-6">
        <BackButton />
        <MemberDetailActions member={typedMember} />
        {isAdmin && (
          <MemberStatusSection
            memberId={typedMember.id}
            memberName={typedMember.name}
            isActive={typedMember.is_active}
            deletedAt={(typedMember as any).deleted_at ?? null}
            permissionRole={typedMember.permission_role}
            authUserId={(typedMember as any).auth_user_id ?? null}
          />
        )}

      <Card className="mb-4 overflow-hidden p-0 text-center">
        <div className="border-b-2 border-clay-400 bg-line-200/40 px-5 pb-5 pt-6">
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="name-kr text-line-900">{typedMember.name}</h1>
              {!typedMember.is_active && (
                <span className="rounded-sm border border-line-300/40 bg-line-200 px-2 py-0.5 text-[10px] font-semibold text-line-500">
                  탈퇴
                </span>
              )}
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
            {typedMember.nickname && typedMember.nickname !== typedMember.name && (
              <p className="text-sm text-line-500">{typedMember.nickname}</p>
            )}
            {typedMember.role !== null && (
              <span className="rounded-full bg-line-200 px-2 py-0.5 text-[11px] font-semibold text-line-700">
                {typedMember.role}
              </span>
            )}
            {typedMember.player_background !== "none" && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                {playerBackgroundLabel(typedMember.player_background)}
              </span>
            )}
            {typedMember.is_dormant && (
              <span className="rounded-full bg-line-200 px-2 py-0.5 text-[11px] font-semibold text-line-600">
                휴면
              </span>
            )}
          </div>

          <p className="font-score mt-3 text-6xl font-bold leading-none text-clay-400">{typedMember.league_point}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-line-500">LP</p>
        </div>

        {/* 우선 노출 지표: 마포구 점수 / 경기수 / 승률 (LP는 위에서 이미 크게 표시됨) */}
        <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
          <div>
            <p className="font-score text-xl font-bold text-clay-400">
              {typedMember.mapo_score !== null ? typedMember.mapo_score : "—"}
            </p>
            <p className="text-xs text-line-500">마포구 점수</p>
          </div>
          <div>
            <p className="font-score text-xl font-bold text-line-900">{matchesPlayed}</p>
            <p className="text-xs text-line-500">경기수</p>
          </div>
          <div>
            <p className="font-score text-xl font-bold text-line-900">{typedMember.win_rate}%</p>
            <p className="text-xs text-line-500">승률</p>
          </div>
        </div>

        {/* 승/패 상세는 보조 정보로 유지 */}
        <div className="grid grid-cols-2 gap-2 border-t border-line-200 px-5 py-3 text-center">
          <div>
            <p className="font-score text-lg font-bold text-gold">{typedMember.wins}</p>
            <p className="text-xs text-line-500">승</p>
          </div>
          <div>
            <p className="font-score text-lg font-bold text-line-500">{typedMember.losses}</p>
            <p className="text-xs text-line-500">패</p>
          </div>
        </div>

        {typedMember.phone && (
          <div className="border-t border-line-200 px-5 py-3 text-center">
            {isAdmin ? (
              <>
                <p className="text-xs text-line-500">휴대폰</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <p className="text-sm font-semibold text-line-900">{typedMember.phone}</p>
                  <CallButton phone={typedMember.phone} />
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <CallButton phone={typedMember.phone} />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 대표 커리어는 회원 상세 가장 상단(프로필 카드 다음)에 단독으로
          노출한다. 없으면 컴포넌트 자체가 null을 반환해 영역이 숨겨진다.
          데이터는 MemberCareerProvider context에서 가져온다(memberId
          전달 불필요, props 없이 호출). */}
      <MemberHighlightCareer />

      {/* 1. 최근 경기 */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">최근 경기</h2>
          <Link href={`/matches?member=${typedMember.id}`} className="text-xs font-semibold text-clay-400">
            전체보기 →
          </Link>
        </div>
        {recentMatches.length === 0 ? (
          <Card className="p-4 text-center text-sm text-line-400">최근 경기 기록이 없습니다.</Card>
        ) : (
          <div className="space-y-2">
            {recentMatches.map((summary) => (
              <Link key={summary.match.id} href={`/matches?member=${typedMember.id}`}>
                <Card className="p-3">
                  <div className="flex items-center justify-between text-xs text-line-400">
                    <span>{summary.match.played_at}</span>
                    <span>
                      {summary.match.sessionDay ? MATCH_SESSION_DAY_LABEL[summary.match.sessionDay] : "세션 정보 없음"}
                      {summary.match.sessionTitle &&
                        (summary.match.sessionDay === "holiday" || summary.match.sessionDay === "custom") &&
                        ` · ${summary.match.sessionTitle}`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-line-700">
                      {typedMember.name}
                      {summary.partner && ` / ${summary.partner.name}`}
                    </span>
                    <Badge tone={summary.won ? "court" : "fault"}>{summary.won ? "승" : "패"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-line-500">
                    vs {summary.opponents.map((o) => o.name).join(" / ")}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-score text-sm font-bold text-line-900">
                      {summary.myScore}:{summary.opponentScore}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        summary.lpChange && summary.lpChange > 0 ? "text-gold" : "text-line-500"
                      }`}
                    >
                      {summary.lpChange && summary.lpChange > 0 ? `+${summary.lpChange} LP` : "LP 변화 없음"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MemberTimelineSection />

      {/* 2. 최근 출석 + 3. 출석률 */}
      <section className="mb-4">
        <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-line-500">최근 출석</h2>
        {recentAttendance.length === 0 ? (
          <Card className="p-4 text-center text-sm text-line-400">최근 출석 기록이 없습니다.</Card>
        ) : (
          <div className="space-y-2">
            {recentAttendance.map((row) => (
              <Card key={row.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold text-line-900">{row.sessionDate}</p>
                  <p className="text-xs text-line-500">
                    {row.sessionDay ? MATCH_SESSION_DAY_LABEL[row.sessionDay] : "세션 정보 없음"}
                    {row.sessionStatus && ` · ${SESSION_STATUS_LABEL[row.sessionStatus] ?? row.sessionStatus}`}
                  </p>
                </div>
                <Badge
                  tone={
                    row.status === "attending" ? "court" : row.status === "absent" ? "fault" : "amber"
                  }
                >
                  {ATTENDANCE_STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Card className="p-3 text-center">
            <p className="font-score text-xl font-bold text-line-900">
              {attendanceRate.overallRate !== null ? `${attendanceRate.overallRate}%` : "—"}
            </p>
            <p className="text-xs text-line-500">전체 출석률 ({attendanceRate.overallCount}회)</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="font-score text-xl font-bold text-line-900">
              {attendanceRate.recentRate !== null ? `${attendanceRate.recentRate}%` : "—"}
            </p>
            <p className="text-xs text-line-500">최근 {attendanceRate.recentSampleSize}회 출석률</p>
          </Card>
        </div>
      </section>

      {/* 4. LP 이력 미리보기 */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">LP 이력</h2>
          <Link
            href={`/point-history?member=${typedMember.id}`}
            className="text-xs font-semibold text-clay-400"
          >
            LP 이력 보기 →
          </Link>
        </div>
        {recentPointHistory.length === 0 ? (
          <Card className="p-4 text-center text-sm text-line-400">LP 변동 내역이 없습니다.</Card>
        ) : (
          <div className="space-y-2">
            {groupPointHistoryByMatch(recentPointHistory).map((group) => (
              <Card key={group.key} className="p-3">
                {group.entries.length > 1 && (
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                    같은 경기에 대한 변동 {group.entries.length}건
                  </p>
                )}
                <div className="space-y-1.5">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between">
                      <span className="text-xs text-line-500">
                        {new Date(entry.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                      <span className="text-xs font-semibold text-line-700">
                        {pointHistoryReasonLabel(entry.reason)}
                      </span>
                      <span
                        className={`font-score text-sm font-bold ${
                          entry.pointChange > 0
                            ? "text-gold"
                            : entry.pointChange < 0
                            ? "text-line-500"
                            : "text-line-500"
                        }`}
                      >
                        {entry.pointChange > 0 ? "+" : ""}
                        {entry.pointChange} LP
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 6. 최근 파트너 */}
      <section className="mb-4">
        <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-line-500">최근 파트너</h2>
        {recentPartners.length === 0 ? (
          <Card className="p-4 text-center text-sm text-line-400">최근 파트너 정보가 없습니다.</Card>
        ) : (
          <div className="space-y-1.5">
            {recentPartners.map((partner) => (
              <Card key={`${partner.isGuest ? "guest" : "member"}:${partner.id}`} className="flex items-center justify-between p-3">
                <span className="text-sm font-medium text-line-900">{partner.name}</span>
                <span className="text-xs font-semibold text-line-500">{partner.count}회</span>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 5. 회원 메모 (운영진 전용 — 조회/수정 모두 운영진만. 수정은 "회원 정보 수정" 모달에서) */}
      {isAdmin && (
        <section className="mb-4">
          <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-line-500">회원 메모</h2>
          <Card className="p-4 text-sm text-line-700">
            {typedMember.memo ? (
              <p className="whitespace-pre-wrap">{typedMember.memo}</p>
            ) : (
              <p className="text-line-400">메모가 없습니다.</p>
            )}
          </Card>
        </section>
      )}
      </main>
    </MemberCareerProvider>
  );
}
