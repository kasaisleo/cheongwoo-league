import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { Member } from "@/lib/supabase/database.types";

interface PointHistoryPageProps {
  searchParams: { member?: string };
}

interface PointHistoryRow {
  id: string;
  match_id: string | null;
  member_id: string;
  point_before: number;
  point_after: number;
  point_change: number;
  reason: string;
  created_at: string;
  member: Pick<Member, "name"> | null;
  match: {
    played_at: string;
    session: { session_day: "saturday" | "sunday" | "holiday" | "custom"; title: string } | null;
  } | null;
}

const REASON_LABEL: Record<string, string> = {
  regular_match_win: "경기 승리",
  regular_match_loss: "경기 패배",
  regular_match_rollback: "삭제/수정 보정 이력",
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

export default async function PointHistoryPage({ searchParams }: PointHistoryPageProps) {
  const supabase = createClient();
  const filterMemberId = searchParams.member;

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true)
    .order("name");

  let historyQuery: any = supabase
    .from("point_history")
    .select(
      `id, match_id, member_id, point_before, point_after, point_change, reason, created_at,
       member:members!point_history_member_id_fkey(name),
       match:matches!point_history_match_id_fkey(played_at, session:attendance_sessions!matches_session_id_fkey(session_day, title))`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filterMemberId) {
    historyQuery = historyQuery.eq("member_id", filterMemberId);
  }

  const { data: historyRows } = await historyQuery;
  const memberList = (members ?? []) as Member[];
  const history = (historyRows ?? []) as unknown as PointHistoryRow[];

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Point History
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          포인트 히스토리
        </h1>
      </header>

      {/* 회원 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/point-history">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !filterMemberId
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200 bg-line-50 text-line-800"
            }`}
          >
            전체
          </span>
        </Link>
        {memberList.map((member) => (
          <Link key={member.id} href={`/point-history?member=${member.id}`}>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filterMemberId === member.id
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : "border-line-200 bg-line-50 text-line-800"
              }`}
            >
              {member.name}
            </span>
          </Link>
        ))}
      </div>

      {history.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          {filterMemberId ? "이 회원의 포인트 변동 기록이 없어요." : "아직 포인트 변동 기록이 없어요."}
        </Card>
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
                    {row.member?.name ?? "알 수 없음"}
                  </span>
                  <span
                    className={`font-score text-lg font-bold ${
                      isZero ? "text-line-500" : isPositive ? "text-court-400" : "text-fault-400"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {row.point_change}
                  </span>
                </div>
                <p className="mt-1 text-xs text-line-500">
                  {row.point_before} → {row.point_after}
                </p>
                {row.match_id && row.match ? (
                  <p className="mt-1 text-xs text-line-400">
                    연결된 경기: {row.match.played_at}
                    {row.match.session &&
                      ` · ${MATCH_SESSION_DAY_LABEL[row.match.session.session_day]}`}
                    {row.match.session &&
                      (row.match.session.session_day === "holiday" ||
                        row.match.session.session_day === "custom") &&
                      ` (${row.match.session.title})`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-line-400">삭제/수정 보정 이력</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
