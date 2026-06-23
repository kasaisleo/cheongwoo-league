import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { Card } from "@/components/ui/Card";
import { Badge, gradeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConvertGuestButton } from "@/components/guest/ConvertGuestButton";
import type { GuestWithStats, Member } from "@/lib/supabase/database.types";

type GuestWithReferrer = GuestWithStats & {
  referrer: Pick<Member, "nickname"> | null;
  converted_member: Pick<Member, "nickname"> | null;
};

export default async function GuestsPage() {
  const supabase = createClient();
  const isAdmin = isAdminSession();

  const { data } = await supabase
    .from("guest_stats")
    .select(
      "*, referrer:members!guests_referred_by_fkey(nickname), converted_member:members!guests_converted_to_member_id_fkey(nickname)"
    )
    .order("visit_date", { ascending: false });

  const guests = (data ?? []) as unknown as GuestWithReferrer[];

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Guests
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">게스트 관리</h1>
        </div>
        <Link href="/guests/new">
          <Button size="md">+ 게스트 등록</Button>
        </Link>
      </header>

      {guests.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          등록된 게스트가 없어요.
        </Card>
      ) : (
        <div className="space-y-2">
          {guests.map((guest) => (
            <Card key={guest.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-line-900">{guest.name}</span>
                  {guest.skill_grade && (
                    <Badge tone={gradeTone(guest.skill_grade)}>{guest.skill_grade}</Badge>
                  )}
                </div>
                <span className="text-xs text-line-400">{guest.visit_date}</span>
              </div>

              <p className="mt-1 text-xs text-line-500">
                {guest.age !== null && `${guest.age}세`}
                {guest.age !== null && guest.years_playing !== null && " · "}
                {guest.years_playing !== null && `구력 ${guest.years_playing}년`}
                {(guest.age !== null || guest.years_playing !== null) && guest.phone && " · "}
                {guest.phone}
              </p>

              {(guest.wins > 0 || guest.losses > 0) && (
                <p className="mt-1 text-xs text-line-500">
                  {guest.wins}승 {guest.losses}패 · 승률 {guest.win_rate}%
                </p>
              )}

              <div className="mt-1.5 flex items-center justify-between text-xs text-line-500">
                <span>소개자: {guest.referrer?.nickname ?? "없음"}</span>
                <div className="flex items-center gap-2">
                  {guest.manner_score !== null && <span>매너 {guest.manner_score}/5</span>}
                  {guest.reinvite !== null && (
                    <Badge tone={guest.reinvite ? "court" : "fault"}>
                      {guest.reinvite ? "재초청 희망" : "재초청 보류"}
                    </Badge>
                  )}
                </div>
              </div>

              {guest.notes && <p className="mt-1.5 text-xs text-line-400">{guest.notes}</p>}

              {guest.converted_to_member_id ? (
                <p className="mt-2 text-xs font-semibold text-court-400">
                  ✓ 정회원으로 전환됨 ({guest.converted_member?.nickname ?? "회원"})
                </p>
              ) : (
                isAdmin && (
                  <ConvertGuestButton
                    guestId={guest.id}
                    guestName={guest.name}
                    suggestedGrade={guest.skill_grade}
                    guestPhone={guest.phone}
                  />
                )
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
