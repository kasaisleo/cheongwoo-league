import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { MemberWithStats } from "@/lib/supabase/database.types";

export default async function RankingPage() {
  const supabase = createClient();

  const { data: rankedMembers } = await supabase
    .from("member_stats")
    .select("*")
    .eq("is_active", true)
    .order("league_point", { ascending: false })
    .order("win_rate", { ascending: false })
    .order("wins", { ascending: false });

  const members = (rankedMembers ?? []) as MemberWithStats[];

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Ranking
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          랭킹
        </h1>
      </header>

      {members.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          아직 등록된 회원이 없어요.
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((member, index) => {
            const isTop = index === 0;
            return (
              <Link key={member.id} href={`/members/${member.id}`}>
                <Card
                  className={`flex items-center gap-3 p-3 ${
                    isTop ? "border-clay-400 bg-line-100" : ""
                  }`}
                >
                  <span
                    className={`font-score w-7 text-center text-lg font-bold ${
                      isTop ? "text-clay-400" : "text-line-500"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-line-900">{member.name}</span>
                      {member.mapo_score !== null && (
                        <span className="rounded-full bg-line-200 px-1.5 py-0.5 text-[10px] font-semibold text-line-700">
                          MAPO {member.mapo_score}
                        </span>
                      )}
                      {member.is_dormant && (
                        <span className="rounded-full bg-line-200 px-1.5 py-0.5 text-[10px] font-semibold text-line-600">
                          휴면
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-line-500">
                      {member.wins}승 {member.losses}패 (W-L) · 승률 {member.win_rate}%
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-score text-2xl font-bold ${
                        isTop ? "text-clay-400" : "text-line-900"
                      }`}
                    >
                      {member.league_point}
                    </span>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">LP</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
