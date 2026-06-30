import Link from "next/link";
import { RankMovement } from "@/components/ui/RankMovement";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * RankingTeaserCard — 홈 화면에서 랭킹 상위 3명을 ATP Tour 스타일로 표시.
 *
 * ATP Tour 메인 페이지의 "Ranking Highlights" 섹션에서 영감을 받았다:
 *   - #1은 gold 강조 + 대형 표시 (Championship 느낌)
 *   - #2, #3은 컴팩트 리스트
 *   - LP는 "ranking point"처럼 숫자 + LP 접미어
 *   - RankMovement(▲▼—)로 순위 변동 표시
 *   - 하단 CTA는 일반 버튼이 아닌 "VIEW FULL RANKINGS →" 텍스트 링크
 *
 * Wimbledon eyebrow:
 *   isWimbledonSeason=true이면 상단 eyebrow에 초록 배지 추가.
 *   기본적으로 비활성 — 시즌 오픈 시 true로 변경.
 *
 * RankMovement delta:
 *   현재 DB에 이전 순위 이력이 없으므로 delta=0(—)으로 표시.
 *   향후 rank_history 테이블이 추가되면 실제 delta를 받을 수 있다.
 */

interface RankingTeaserCardProps {
  members: MemberWithStats[];   // 상위 3명 (이미 정렬된 상태로 전달)
  isWimbledonSeason?: boolean;  // 윔블던 시즌 오버레이 활성화 여부
}

export function RankingTeaserCard({
  members,
  isWimbledonSeason = false,
}: RankingTeaserCardProps) {
  if (members.length === 0) return null;

  const [first, second, third] = members;

  return (
    <section className="mb-4">
      {/* ── 섹션 헤더 ──────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-clay-400">
            Current Rankings
          </p>
          {/* Wimbledon Season 오버레이 배지 */}
          {isWimbledonSeason && (
            <span className="inline-flex items-center gap-1 rounded-full border border-wimbledon/50 bg-wimbledon/20 px-2 py-0.5 text-[10px] font-semibold text-wimbledon-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-wimbledon" />
              Wimbledon Edition
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-line-500">
          Season 2026
        </span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

        {/* ── #1 Champion Row — gold 강조, 대형 ─────────────── */}
        {first && (
          <Link href="/ranking" className="block">
            <div className="relative border-b border-line-200/30 px-4 py-4 transition-colors hover:bg-line-100/40">

              {/* eyebrow: #1 순위 표시 */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="font-display text-4xl font-bold leading-none tabular-nums text-gold">
                  1
                </span>
                <span className="font-display text-xs font-bold uppercase tracking-widest text-gold/70">
                  Champion
                </span>
              </div>

              {/* 이름 + LP + 변동 */}
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-bold tracking-tight text-line-900">
                    {first.name}
                  </p>
                  <p className="mt-0.5 text-xs text-line-500">
                    {first.wins}승 {first.losses}패
                    <span className="mx-1 text-line-300">·</span>
                    {Math.round(first.win_rate * 100)}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RankMovement delta={0} showFlat={false} />
                  <div className="text-right">
                    <p className="font-score text-2xl font-bold tabular-nums text-gold">
                      {first.league_point.toLocaleString()}
                    </p>
                    <p className="text-right font-display text-[9px] font-bold uppercase tracking-widest text-gold/60">
                      LP
                    </p>
                  </div>
                </div>
              </div>

              {/* gold accent bar — 좌측 세로선 */}
              <div className="absolute left-0 top-0 h-full w-1 rounded-r-sm bg-gold/60" />
            </div>
          </Link>
        )}

        {/* ── #2, #3 리스트 Row ──────────────────────────────── */}
        {[second, third].map((member, idx) => {
          if (!member) return null;
          const rank = idx + 2;
          return (
            <Link key={member.id} href="/ranking" className="block">
              <div
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${
                  idx === 0 ? "border-b border-line-200/30" : ""
                }`}
              >
                {/* 순위 번호 */}
                <span className="w-5 shrink-0 font-display text-sm font-bold tabular-nums text-line-500">
                  {rank}
                </span>

                {/* 이름 + 전적 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-line-800">
                    {member.name}
                  </p>
                  <p className="text-[10px] text-line-500">
                    {member.wins}승 {member.losses}패
                  </p>
                </div>

                {/* LP + 변동 */}
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

        {/* ── CTA: VIEW FULL RANKINGS → ──────────────────────── */}
        <Link
          href="/ranking"
          className="flex items-center justify-between border-t border-line-200/30 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-clay-400 transition-colors hover:bg-line-100/40"
        >
          <span>View Full Rankings</span>
          <span aria-hidden="true">→</span>
        </Link>

      </div>
    </section>
  );
}
