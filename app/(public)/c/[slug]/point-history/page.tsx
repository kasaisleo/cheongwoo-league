import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { EmptyState } from "@/components/ui/SectionHeader";
import { PublicShell } from "@/components/shell";
import type { PointHistoryV2RpcRow } from "@/lib/point-history";
import { normalizePublicMemberListRow, type PublicMemberListRow, type RawPublicMemberListRow } from "@/lib/public-member";
import { memberPublicToken, resolveMemberByToken } from "@/lib/public-member-token";

export const dynamic = "force-dynamic";

interface PointHistoryPageProps {
  params: { slug: string };
  searchParams: { member?: string };
}

const REASON_LABEL: Record<string, string> = {
  regular_match_win: "경기 승리",
  regular_match_loss: "경기 패배",
  regular_match_rollback: "삭제/수정 보정 이력",
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

export default async function ClubPointHistoryPage({ params, searchParams }: PointHistoryPageProps) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);

  const supabase = createClient();
  const filterMemberToken = searchParams.member;

  // members는 anon/authenticated GRANT가 회수되어(0037) 직접 조회할 수 없다 —
  // 이미 club_id/is_active/deleted_at 필터를 강제하는 공개 RPC를 재사용한다.
  const { data: members } = await supabase
    .rpc("get_public_member_list", { p_club_id: club.id })
    .order("name");

  // 2A-8D-4: RPC 경계 정규화(0067 적용 전 응답 호환).
  const memberList: PublicMemberListRow[] = (members ?? []).map((r: RawPublicMemberListRow) => normalizePublicMemberListRow(r));

  // 토큰이 이 클럽 회원 목록 안에서 매칭되는 경우에만 실제 회원으로 취급한다.
  // 타 클럽 토큰이나 잘못된 토큰은 "필터 없음"(전체 조회)으로 조용히 되돌리지
  // 않고, 아래에서 명시적으로 빈 결과로 처리한다(matches P0와 동일 원칙).
  const resolvedMember = filterMemberToken
    ? resolveMemberByToken(club.id, filterMemberToken, memberList)
    : null;
  const invalidMemberFilter = Boolean(filterMemberToken) && !resolvedMember;

  const historyRows = invalidMemberFilter
    ? []
    : (
        await supabase.rpc("get_public_point_history_v2", {
          p_club_id: club.id,
          p_member_id: resolvedMember?.id ?? null,
        })
      ).data;
  const history = (historyRows ?? []) as PointHistoryV2RpcRow[];

  const baseHref = `/c/${slug}/point-history`;

  return (
    <PublicShell>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clay-400" />
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-clay-400">
              Point History
            </p>
          </div>
          <h1 className="headline-kr text-3xl text-line-900">
            포인트 히스토리
          </h1>
        </div>
        <Link
          href={`/c/${slug}`}
          className="club-back-link"
        >
          ← 클럽 홈
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={baseHref}>
          <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${!filterMemberToken ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
            전체
          </span>
        </Link>
        {memberList.map((member) => {
          const token = memberPublicToken(club.id, member.id);
          return (
            <Link key={token} href={`${baseHref}?member=${token}`}>
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${filterMemberToken === token ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
                {member.name}
              </span>
            </Link>
          );
        })}
      </div>

      {invalidMemberFilter ? (
        <EmptyState message="선택한 선수를 찾을 수 없어요." />
      ) : history.length === 0 ? (
        <EmptyState message={filterMemberToken ? "이 회원의 포인트 변동 기록이 없어요." : "아직 포인트 변동 기록이 없어요."} />
      ) : (
        <div className="space-y-2">
          {history.map((row, idx) => {
            const isPositive = row.point_change > 0;
            const isZero = row.point_change === 0;
            const dateLabel = new Date(row.created_at).toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <Card key={`${row.match_group_token ?? "standalone"}-${row.created_at}-${row.reason}-${idx}`} className="p-3">
                <div className="flex items-center justify-between text-xs text-line-400">
                  <span>{dateLabel}</span>
                  <Badge tone={isZero ? "neutral" : isPositive ? "court" : "fault"}>
                    {reasonLabel(row.reason)}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-line-900">
                    {row.member_name ?? "알 수 없음"}
                  </span>
                  <span className={`font-score text-lg font-bold ${isZero ? "text-line-500" : isPositive ? "text-win" : "text-loss"}`}>
                    {isPositive ? "+" : ""}
                    {row.point_change}
                  </span>
                </div>
                <p className="mt-1 text-xs text-line-500">
                  {row.point_before} → {row.point_after}
                </p>
                {row.match_played_at ? (
                  <p className="mt-1 text-xs text-line-400">
                    연결된 경기: {row.match_played_at}
                    {row.session_day && ` · ${MATCH_SESSION_DAY_LABEL[row.session_day]}`}
                    {row.session_day &&
                      (row.session_day === "holiday" || row.session_day === "custom") &&
                      ` (${row.session_title})`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-line-400">삭제/수정 보정 이력</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
