import Link from "next/link";
import { RankMovement } from "@/components/ui/RankMovement";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * RankingTeaserCard — 홈 화면 랭킹 상위 3명 표시.
 *
 * 부모 SectionHeader("현재 순위")가 섹션 타이틀을 담당하므로
 * 이 컴포넌트는 카드 본문만 렌더한다.
 *
 * isWimbledonSeason: 윔블던 시즌 활성화 시 1위 카드에 배지 표시.
 */

interface RankingTeaserCardProps {
  members: MemberWithStats[];
  isWimbledonSeason?: boolean;
  rankingHref?: string;
}

export function RankingTeaserCard({
  members,
  isWimbledonSeason = false,
  rankingHref = "/ranking",
}: RankingTeaserCardProps) {
  if (members.length === 0) return null;

  const [first, second, third] = members;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

      {/* ── #1 Champion Row ──────────────────────────────────── */}
      {first && (
        <Link href={rankingHref} className="block">
          <div className="relative border-b border-line-200/30 px-4 py-4 transition-colors hover:bg-line-100/40">

            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="font-display text-4xl font-bold leading-none tabular-nums text-gold">
                1
              </span>
              <span className="font-display text-xs font-bold uppercase tracking-widest text-gold/70">
                Champion
              </span>
              {isWimbledonSeason && (
                <span className="inline-flex items-center gap-1 rounded-full border border-wimbledon/50 bg-wimbledon/20 px-2 py-0.5 text-[10px] font-semibold text-wimbledon-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-wimbledon" />
                  Wimbledon
                </span>
              )}
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="name-kr-lg text-line-900">{first.name}</p>
                <p className="mt-0.5 text-xs text-line-500">
                  {first.wins}승 {first.losses}패
                  <span className="mx-1 text-line-300">·</span>
                  {Math.round(first.win_rate)}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RankMovement delta={0} showFlat={false} />
                <div className="text-right">
                  <p className="font-score text-2xl font-bold tabular-nums text-gold">
                    {first.league_point.toLocaleString()}
                  </p>
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-gold/60">
                    LP
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute left-0 top-0 h-full w-1 rounded-r-sm bg-gold/60" />
          </div>
        </Link>
      )}

      {/* ── #2, #3 리스트 Row ───────────────────────────────── */}
      {[second, third].map((member, idx) => {
        if (!member) return null;
        const rank = idx + 2;
        return (
          <Link key={member.id} href={rankingHref} className="block">
            <div
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${
                idx === 0 ? "border-b border-line-200/30" : ""
              }`}
            >
              <span className="w-5 shrink-0 font-display text-sm font-bold tabular-nums text-line-500">
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-line-800">{member.name}</p>
                <p className="text-[10px] text-line-500">
                  {member.wins}승 {member.losses}패
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <RankMovement delta={0} showFlat={false} />
                <div className="text-right">
                  <span className="font-score text-sm font-bold tabular-nums text-line-700">
                    {member.league_point.toLocaleString()}
                  </span>
                  <span className="ml-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-line-500">
                    LP
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}

      {/* ── CTA ─────────────────────────────────────────────── */}
      <Link
        href={rankingHref}
        className="flex items-center justify-between border-t border-line-200/30 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-clay-400 transition-colors hover:bg-line-100/40"
      >
        <span>View Full Rankings</span>
        <span aria-hidden="true">→</span>
      </Link>

    </div>
  );
}
