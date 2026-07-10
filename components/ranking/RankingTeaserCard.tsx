import Link from "next/link";
import { RankMovement } from "@/components/ui/RankMovement";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * RankingTeaserCard — 홈 화면 랭킹 상위 3명 표시.
 *
 * 부모 SectionHeader("현재 순위")의 CTA("전체 랭킹")가 이미 있으므로
 * 카드 하단 CTA 없음.
 *
 * gold는 1위 rank number와 Champion 레이블에만 제한.
 * full-height gold left bar 제거 — border와의 충돌 해소.
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
          <div className="border-b border-line-200/30 px-4 py-4 transition-colors hover:bg-line-100/40">

            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-display text-3xl font-bold leading-none tabular-nums text-gold">
                1
              </span>
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-gold/60">
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
                  <p className="font-score text-xl font-bold tabular-nums text-line-700">
                    {first.league_point.toLocaleString()}
                  </p>
                  <p className="font-display text-[9px] font-semibold uppercase tracking-wide text-line-400">
                    LP
                  </p>
                </div>
              </div>
            </div>
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
              <span className="w-5 shrink-0 font-display text-sm font-bold tabular-nums text-line-400">
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
                  <span className="font-score text-sm font-bold tabular-nums text-line-600">
                    {member.league_point.toLocaleString()}
                  </span>
                  <span className="ml-0.5 font-display text-[9px] font-semibold uppercase tracking-wide text-line-400">
                    LP
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}

    </div>
  );
}
