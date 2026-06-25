import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge, gradeTone } from "@/components/ui/Badge";
import { MemberDetailActions } from "@/components/member/MemberDetailActions";
import { notFound } from "next/navigation";
import type { MemberWithStats } from "@/lib/supabase/database.types";

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

  const typedMember = member as MemberWithStats;
  const matchesPlayed = typedMember.wins + typedMember.losses;

  return (
    <main className="px-4 pt-6">
      <MemberDetailActions member={typedMember} />

      <Card className="mb-4 overflow-hidden p-0 text-center">
        <div className="border-b-2 border-clay-400 bg-line-200/40 px-5 pb-5 pt-6">
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-line-900">{typedMember.nickname}</h1>
            <Badge tone={gradeTone(typedMember.grade)}>{typedMember.grade}급</Badge>
          </div>
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <p className="text-sm text-line-500">{typedMember.name}</p>
            {typedMember.role !== "정회원" && (
              <span className="rounded-full bg-line-200 px-2 py-0.5 text-[11px] font-semibold text-line-700">
                {typedMember.role}
              </span>
            )}
          </div>

          <p className="font-score mt-3 text-6xl font-bold leading-none text-clay-400">{typedMember.league_point}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-line-500">LP</p>
        </div>

        <div className="grid grid-cols-4 gap-2 px-5 py-4 text-center">
          <div>
            <p className="font-score text-xl font-bold text-line-900">{matchesPlayed}</p>
            <p className="text-xs text-line-500">경기수</p>
          </div>
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

        {(typedMember.phone || typedMember.mapo_score !== null) && (
          <div className="grid grid-cols-2 gap-2 border-t border-line-200 px-5 py-3 text-center">
            <div>
              <p className="text-xs text-line-500">휴대폰</p>
              <p className="text-sm font-semibold text-line-900">{typedMember.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-line-500">마포구 점수</p>
              <p className="font-score text-sm font-bold text-court-400">
                {typedMember.mapo_score !== null ? `${typedMember.mapo_score}점` : "—"}
              </p>
            </div>
          </div>
        )}
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">포인트(LP) 변동</h2>
          <Link
            href={`/point-history?member=${typedMember.id}`}
            className="text-xs font-semibold text-clay-400"
          >
            LP 히스토리 보기 →
          </Link>
        </div>
        <Card className="p-4 text-center text-sm text-line-400">
          이 회원의 LP 변동 내역은 위 "LP 히스토리 보기"에서 확인할 수 있어요.
        </Card>
      </section>
    </main>
  );
}
