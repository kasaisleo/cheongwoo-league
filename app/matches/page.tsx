import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import type { Member } from "@/lib/supabase/database.types";

interface MatchesPageProps {
  searchParams: { member?: string };
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const supabase = createClient();
  const filterMemberId = searchParams.member;

  const [{ data: members }, matchesResult] = await Promise.all([
    supabase.from("members").select("*").eq("is_active", true).order("nickname"),
    filterMemberId
      ? supabase
          .from("matches")
          .select(MATCH_SELECT_WITH_PLAYERS)
          .or(
            `team_a_player1_member.eq.${filterMemberId},team_a_player2_member.eq.${filterMemberId},team_b_player1_member.eq.${filterMemberId},team_b_player2_member.eq.${filterMemberId}`
          )
          .order("played_at", { ascending: false })
          .order("created_at", { ascending: false })
      : supabase
          .from("matches")
          .select(MATCH_SELECT_WITH_PLAYERS)
          .order("played_at", { ascending: false })
          .order("created_at", { ascending: false }),
  ]);

  const memberList = (members ?? []) as Member[];
  const matches = toDisplayMatches(matchesResult.data);

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Match History
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          경기 기록
        </h1>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/matches">
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
          <Link key={member.id} href={`/matches?member=${member.id}`}>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filterMemberId === member.id
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : "border-line-200 bg-line-50 text-line-800"
              }`}
            >
              {member.nickname}
            </span>
          </Link>
        ))}
      </div>

      {matches.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          {filterMemberId
            ? "이 회원의 경기 기록이 없어요."
            : "아직 등록된 경기가 없어요. 경기입력 탭에서 첫 경기를 기록해보세요."}
        </Card>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </main>
  );
}
