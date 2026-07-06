import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RankMovement } from "@/components/ui/RankMovement";
import { applyRankingQuery } from "@/lib/ranking-query";
import type { MemberWithStats } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * Ranking Page v2 — ATP Tour 스타일 랭킹 화면 (Step 15-4).
 *
 * 데이터 일관성 수정 (버그 발견: 2026-06-30):
 *   Home RankingTeaserCard와 동일한 applyRankingQuery() 사용
 *   → is_dormant: false 추가로 휴면 회원 제외
 *   → Home Top 3 = Ranking Page Top 3 보장
 *
 * win_rate: member_stats 뷰가 0~100 값으로 저장됨 (이미 % 값)
 */

// selected_club_id 쿠키에 따라 결과가 달라지는 서버 페이지이므로,
// Next.js의 static optimization/캐시에 걸리지 않도록 매 요청마다 새로 렌더링한다.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();

  const { data: rankedMembers } = await applyRankingQuery(supabase, undefined, currentClubId);

  const members = (rankedMembers ?? []) as MemberWithStats[];

  const [first, second, third, ...rest] = members;

  return (
    <main className="px-4 pt-6 pb-28">

      {/* ── 페이지 헤더 */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Ranking</p>
          <h1 className="headline-kr text-4xl text-line-900">랭킹</h1>
          <p className="mt-1 max-w-[240px] break-keep text-xs leading-relaxed text-line-500">
            청우회 리그 순위와 기록을 확인합니다.
          </p>
        </div>
        <Link href="/"
          className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 홈
        </Link>
      </header>

      {members.length === 0 ? (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-line-500">
            No Rankings Yet
          </p>
          <p className="mt-1 text-xs text-line-400">경기 기록이 쌓이면 순위가 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── #1 Champion Block ─────────────────────────── */}
          {first && (
            <Link href={`/members/${first.id}`}>
              <div className="relative overflow-hidden rounded-[14px] border border-gold/30 bg-line-50 transition-colors hover:border-gold/50">

                {/* gold accent bar */}
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gold/70" />

                <div className="px-5 py-4 pl-7">
                  {/* rank label */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-display text-5xl font-bold leading-none tabular-nums text-gold">
                      1
                    </span>
                    <span className="font-display text-xs font-bold uppercase tracking-widest text-gold/60">
                      Champion
                    </span>
                    <RankMovement delta={0} showFlat={false} />
                  </div>

                  {/* name + stats */}
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="name-kr-lg text-line-900">
                        {first.name}
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="font-semibold text-gold">{first.wins}W</span>
                        <span className="mx-1 text-line-400">·</span>
                        <span className="font-semibold text-line-500">{first.losses}L</span>
                        <span className="mx-1.5 text-line-300">|</span>
                        <span className="text-line-500">
                          {Math.round(first.win_rate)}% Win Rate
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-score text-3xl font-bold tabular-nums text-gold">
                        {first.league_point.toLocaleString()}
                      </p>
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest text-gold/60">
                        LP
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* ── #2, #3 Contender Block ───────────────────── */}
          {(second || third) && (
            <div className="grid grid-cols-2 gap-2">
              {[second, third].map((member, idx) => {
                if (!member) return null;
                const rank = idx + 2;
                return (
                  <Link key={member.id} href={`/members/${member.id}`}>
                    <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 transition-colors hover:border-line-300/60">
                      {/* accent bar - clay 계열 보조 */}
                      <div className="absolute left-0 top-0 h-full w-1 bg-clay-400/40" />
                      <div className="px-3 py-3 pl-5">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <span className="font-display text-2xl font-bold tabular-nums text-clay-400">
                            {rank}
                          </span>
                          <RankMovement delta={0} showFlat={false} />
                        </div>
                        <p className="name-kr-sm truncate text-line-900">
                          {member.name}
                        </p>
                        <p className="mt-0.5 text-[10px]">
                          <span className="text-gold">{member.wins}W</span>
                          <span className="mx-0.5 text-line-400">·</span>
                          <span className="text-line-500">{member.losses}L</span>
                        </p>
                        <div className="mt-2">
                          <p className="font-score text-xl font-bold tabular-nums text-line-800">
                            {member.league_point.toLocaleString()}
                          </p>
                          <p className="font-display text-[9px] font-semibold uppercase tracking-wider text-line-500">
                            LP
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── #4 이하 Ranking Table ─────────────────────── */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-line-200/40 bg-line-100/40 px-4 py-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500 text-center">
                  #
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                  Player
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500 text-right">
                  LP
                </span>
              </div>

              {rest.map((member, idx) => {
                const rank = idx + 4;
                const isLast = idx === rest.length - 1;
                return (
                  <Link key={member.id} href={`/members/${member.id}`}>
                    <div
                      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${
                        isLast ? "" : "border-b border-line-200/30"
                      }`}
                    >
                      {/* 순위 */}
                      <span className="font-display text-sm font-bold tabular-nums text-line-500 text-center">
                        {rank}
                      </span>

                      {/* 이름 + 전적 */}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-line-800">
                          {member.name}
                        </p>
                        <p className="text-[10px]">
                          <span className="text-gold">{member.wins}W</span>
                          <span className="mx-0.5 text-line-400">·</span>
                          <span className="text-line-500">{member.losses}L</span>
                          <span className="ml-1.5 text-line-500">
                            {Math.round(member.win_rate)}%
                          </span>
                        </p>
                      </div>

                      {/* LP + 변동 */}
                      <div className="flex items-center gap-1.5">
                        <RankMovement delta={0} showFlat={false} />
                        <div className="text-right">
                          <span className="font-score text-sm font-bold tabular-nums text-line-800">
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
            </div>
          )}

        </div>
      )}
    </main>
  );
}
