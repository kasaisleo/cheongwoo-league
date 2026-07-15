import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BackButton } from "@/components/member/BackButton";
import { MemberTimelineSection } from "@/components/member/MemberTimelineSection";
import { MemberHighlightCareer } from "@/components/member/MemberHighlightCareer";
import { MemberCareerProvider } from "@/components/member/MemberCareerProvider";
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
import type { PublicMemberDetailRow } from "@/lib/public-member";
import { getAdminAccessServer } from "@/lib/admin-permissions";

/**
 * /c/[slug]/members/[id] — canonical public 회원 상세.
 *
 * 완전 Public 프로필 — 로그인 불필요. get_public_member_detail RPC가
 * club_id + member_id를 동시에 강제하고 활동중(is_active=true, deleted_at
 * is null)인 회원만 반환하므로, 탈퇴/비활성 회원이거나 다른 클럽 소속
 * memberId면 결과가 0건이 되어 notFound()로 처리된다.
 *
 * 관리자 전용 정보(전화번호/메모/권한/카카오 연결/탈퇴 상태)와 회원
 * 정보 수정은 이 페이지에서 다루지 않는다 — /admin/members/[id]에서
 * 전담한다(members P0 대응 Phase 2).
 */

interface Props {
  params: { slug: string; id: string };
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

export default async function ClubMemberDetailPage({ params }: Props) {
  const { slug, id: memberId } = params;

  const club = await requirePublicClubBySlug(slug);
  const clubId = club.id;

  const supabase = createClient();

  const { data } = await supabase.rpc("get_public_member_detail", {
    p_club_id: clubId,
    p_member_id: memberId,
  });
  const member = (data ?? [])[0] as PublicMemberDetailRow | undefined;

  if (!member) notFound();

  const matchesPlayed = member.wins + member.losses;

  const access = await getAdminAccessServer();
  const isAdmin = access.isAdmin;

  const [recentMatches, recentAttendance, attendanceRate, recentPointHistory, recentPartners] =
    await Promise.all([
      fetchMemberRecentMatches(member.id, clubId),
      fetchMemberRecentAttendance(member.id, clubId),
      fetchMemberAttendanceRate(member.id, clubId),
      fetchMemberRecentPointHistory(member.id, clubId),
      fetchMemberRecentPartners(member.id, clubId),
    ]);

  return (
    <MemberCareerProvider memberId={member.id} isAdmin={isAdmin}>
      <main className="px-4 pt-6">
        <BackButton />

        <Card className="mb-4 overflow-hidden p-0 text-center">
          <div className="border-b-2 border-clay-400 bg-line-200/40 px-5 pb-5 pt-6">
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <h1 className="name-kr text-line-900">{member.name}</h1>
            </div>
            <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
              {member.nickname && member.nickname !== member.name && (
                <p className="text-sm text-line-500">{member.nickname}</p>
              )}
              {member.role !== null && (
                <span className="rounded-full bg-line-200 px-2 py-0.5 text-[11px] font-semibold text-line-700">
                  {member.role}
                </span>
              )}
              {member.player_background !== "none" && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                  {playerBackgroundLabel(member.player_background)}
                </span>
              )}
            </div>

            <p className="font-score mt-3 text-6xl font-bold leading-none text-clay-400">{member.league_point}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-line-500">LP</p>
          </div>

          <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
            <div>
              <p className="font-score text-xl font-bold text-clay-400">
                {member.mapo_score !== null ? member.mapo_score : "—"}
              </p>
              <p className="text-xs text-line-500">지역점수</p>
            </div>
            <div>
              <p className="font-score text-xl font-bold text-line-900">{matchesPlayed}</p>
              <p className="text-xs text-line-500">경기수</p>
            </div>
            <div>
              <p className="font-score text-xl font-bold text-line-900">{member.win_rate}%</p>
              <p className="text-xs text-line-500">승률</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-line-200 px-5 py-3 text-center">
            <div>
              <p className="font-score text-lg font-bold text-gold">{member.wins}</p>
              <p className="text-xs text-line-500">승</p>
            </div>
            <div>
              <p className="font-score text-lg font-bold text-line-500">{member.losses}</p>
              <p className="text-xs text-line-500">패</p>
            </div>
          </div>
        </Card>

        <MemberHighlightCareer />

        {/* 최근 경기 */}
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">최근 경기</h2>
            <Link href={`/c/${slug}/matches?member=${member.id}`} className="text-xs font-semibold text-clay-400">
              전체보기 →
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <Card className="p-4 text-center text-sm text-line-400">최근 경기 기록이 없습니다.</Card>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((summary) => (
                <Link key={summary.match.id} href={`/c/${slug}/matches?member=${member.id}`}>
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
                        {member.name}
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
                      <span className={`text-xs font-semibold ${
                        summary.lpChange && summary.lpChange > 0 ? "text-gold" : "text-line-500"
                      }`}>
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

        {/* 최근 출석 */}
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
                  <Badge tone={row.status === "attending" ? "court" : row.status === "absent" ? "fault" : "amber"}>
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

        {/* LP 이력 */}
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">LP 이력</h2>
            <Link href={`/c/${slug}/point-history?member=${member.id}`} className="text-xs font-semibold text-clay-400">
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
                        <span className={`font-score text-sm font-bold ${
                          entry.pointChange > 0 ? "text-gold" : "text-line-500"
                        }`}>
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

        {/* 최근 파트너 */}
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
      </main>
    </MemberCareerProvider>
  );
}
