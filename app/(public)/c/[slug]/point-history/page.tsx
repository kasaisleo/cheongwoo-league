import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { EmptyState } from "@/components/ui/SectionHeader";
import { PublicShell } from "@/components/shell";
import type { PointHistoryRpcRow } from "@/lib/point-history";
import type { PublicMemberListRow } from "@/lib/public-member";

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
  const filterMemberId = searchParams.member;

  // members는 anon/authenticated GRANT가 회수되어(0037) 직접 조회할 수 없다 —
  // 이미 club_id/is_active/deleted_at 필터를 강제하는 공개 RPC를 재사용한다.
  const { data: members } = await supabase
    .rpc("get_public_member_list", { p_club_id: club.id })
    .order("name");

  const memberList = (members ?? []) as PublicMemberListRow[];
  const memberIds = memberList.map((m) => m.id);

  const rpcMemberId = filterMemberId && memberIds.includes(filterMemberId) ? filterMemberId : null;

  const { data: historyRows } = await supabase.rpc("get_public_point_history", {
    p_club_id: club.id,
    p_member_id: rpcMemberId,
  });
  const history = (historyRows ?? []) as PointHistoryRpcRow[];

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
          <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${!filterMemberId ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
            전체
          </span>
        </Link>
        {memberList.map((member) => (
          <Link key={member.id} href={`${baseHref}?member=${member.id}`}>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${filterMemberId === member.id ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
              {member.name}
            </span>
          </Link>
        ))}
      </div>

      {history.length === 0 ? (
        <EmptyState message={filterMemberId ? "이 회원의 포인트 변동 기록이 없어요." : "아직 포인트 변동 기록이 없어요."} />
      ) : (
        <div className="space-y-2">
          {history.map((row) => {
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
              <Card key={row.id} className="p-3">
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
                {row.match_id && row.match_played_at ? (
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
