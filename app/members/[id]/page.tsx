import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge, gradeTone } from "@/components/ui/Badge";
import { notFound } from "next/navigation";
import type { MemberWithStats, RatingHistory } from "@/lib/supabase/database.types";

interface MemberDetailPageProps {
  params: { id: string };
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const supabase = createClient();

  const { data: member } = await supabase
    .from("member_stats")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!member) {
    notFound();
  }

  const { data: history } = await supabase
    .from("rating_history")
    .select("*")
    .eq("member_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const typedMember = member as MemberWithStats;
  const typedHistory = (history ?? []) as RatingHistory[];

  return (
    <main className="px-4 pt-6">
      <Card className="mb-4 overflow-hidden p-0 text-center">
        <div className="border-b-2 border-clay-400 bg-line-200/40 px-5 pb-5 pt-6">
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-line-900">{typedMember.nickname}</h1>
            <Badge tone={gradeTone(typedMember.grade)}>{typedMember.grade}급</Badge>
          </div>
          <p className="text-sm text-line-500">{typedMember.name}</p>

          <p className="font-score mt-3 text-6xl font-bold leading-none text-clay-400">{typedMember.rating}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-line-500">Rating</p>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
          <div>
            <p className="font-score text-xl font-bold text-court-400">{typedMember.wins}</p>
            <p className="text-xs text-line-500">승</p>
          </div>
          <div>
            <p className="font-score text-xl font-bold text-fault-400">{typedMember.losses}</p>
            <p className="text-xs text-line-500">패</p>
          </div>
          <div>
            <p className="font-score text-xl font-bold text-line-900">{typedMember.win_rate}%</p>
            <p className="text-xs text-line-500">승률</p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-line-600">최근 레이팅 변동</h2>
        {typedHistory.length === 0 ? (
          <Card className="p-6 text-center text-sm text-line-400">아직 경기 기록이 없어요.</Card>
        ) : (
          <div className="space-y-1.5">
            {typedHistory.map((h) => (
              <Card key={h.id} className="flex items-center justify-between p-3">
                <span className="text-xs text-line-500">
                  {new Date(h.created_at).toLocaleDateString("ko-KR")}
                </span>
                <span className="font-score text-sm text-line-600">
                  {h.rating_before} → {h.rating_after}
                </span>
                <span
                  className={`font-score text-sm font-bold ${
                    h.rating_change >= 0 ? "text-court-400" : "text-fault-400"
                  }`}
                >
                  {h.rating_change >= 0 ? "+" : ""}
                  {h.rating_change}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
