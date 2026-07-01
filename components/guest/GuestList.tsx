import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { ConvertGuestButton } from "@/components/guest/ConvertGuestButton";
import { GuestAdminActions } from "@/components/guest/GuestAdminActions";
import type { GuestWithStats, Member } from "@/lib/supabase/database.types";

type GuestWithReferrer = GuestWithStats & {
  referrer: Pick<Member, "nickname"> | null;
  converted_member: Pick<Member, "nickname"> | null;
};

interface GuestListProps {
  mode: "public" | "admin";
}

export async function GuestList({ mode }: GuestListProps) {
  const supabase = createClient();
  const isAdmin = mode === "admin";

  // 관리자 모드에서는 비활성 게스트도 표시 (상태 확인용)
  // 공개 모드에서는 활성 게스트만 표시
  let query = supabase
    .from("guest_stats")
    .select(
      "*, referrer:members!guests_referred_by_fkey(nickname), converted_member:members!guests_converted_to_member_id_fkey(nickname)"
    )
    .order("visit_date", { ascending: false });

  if (!isAdmin) {
    query = (query as any).eq("is_active", true);
  }

  const { data } = await query;
  const guests = (data ?? []) as unknown as GuestWithReferrer[];

  // 관리자 권한 확인 (액션 버튼 표시용)
  let canEdit = false;
  let canDeactivate = false;
  if (isAdmin) {
    const access = await getAdminAccessServer();
    canEdit = access.isAdmin;
    canDeactivate = access.isOwner;
  }

  if (mode === "admin") {
    return <AdminGuestList guests={guests} canEdit={canEdit} canDeactivate={canDeactivate} />;
  }
  return <PublicGuestList guests={guests} />;
}

// ── 관리자 목록 ──────────────────────────────────────────────────────
function AdminGuestList({
  guests,
  canEdit,
  canDeactivate,
}: {
  guests: GuestWithReferrer[];
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const active = guests.filter((g) => (g as any).is_active !== false);
  const inactive = guests.filter((g) => (g as any).is_active === false);

  if (guests.length === 0) {
    return (
      <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">No Guests</p>
        <p className="mt-1 text-sm text-line-500">등록된 게스트가 없어요.</p>
        <Link href="/guests/new"
          className="mt-3 inline-block rounded-sm border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400">
          첫 게스트 등록 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 활성 게스트 */}
      {active.length > 0 && (
        <section>
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Active Guests <span className="ml-1 text-line-400">({active.length})</span>
          </p>
          <div className="space-y-3">
            {active.map((guest) => (
              <AdminGuestCard
                key={guest.id}
                guest={guest}
                canEdit={canEdit}
                canDeactivate={canDeactivate}
              />
            ))}
          </div>
        </section>
      )}

      {/* 비활성 게스트 */}
      {inactive.length > 0 && (
        <section>
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-400">
            Inactive <span className="ml-1">({inactive.length})</span>
          </p>
          <div className="space-y-3 opacity-60">
            {inactive.map((guest) => (
              <AdminGuestCard
                key={guest.id}
                guest={guest}
                canEdit={canEdit}
                canDeactivate={false}  // 이미 비활성
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminGuestCard({
  guest,
  canEdit,
  canDeactivate,
}: {
  guest: GuestWithReferrer;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const isInactive = (guest as any).is_active === false;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      {/* 상단 */}
      <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
            {guest.visit_date}
          </span>
          {isInactive && (
            <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
              비활성
            </span>
          )}
          {guest.converted_to_member_id && (
            <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
              정회원 전환됨
            </span>
          )}
        </div>
        {/* 수정/비활성화 액션 — 클라이언트 컴포넌트 */}
        {!isInactive && (canEdit || canDeactivate) && (
          <GuestAdminActions
            guestId={guest.id}
            guestName={guest.name}
            guestPhone={guest.phone}
            guestAge={guest.age}
            guestYearsPlaying={guest.years_playing}
            guestReferredBy={guest.referred_by}
            guestNotes={guest.notes}
            guestVisitDate={guest.visit_date}
            canEdit={canEdit}
            canDeactivate={canDeactivate}
          />
        )}
      </div>

      {/* 본문 */}
      <div className="px-4 py-3">
        <p className="name-kr-sm text-line-900">{guest.name}</p>
        <p className="mt-0.5 text-xs text-line-500">
          {[
            guest.age !== null && `${guest.age}세`,
            guest.years_playing !== null && `구력 ${guest.years_playing}년`,
            guest.phone,
          ].filter(Boolean).join(" · ")}
        </p>
        {(guest.wins > 0 || guest.losses > 0) && (
          <p className="mt-0.5 font-display text-[10px] font-bold tabular-nums text-line-500">
            {guest.wins}W {guest.losses}L · {guest.win_rate}%
          </p>
        )}
        {guest.referrer && (
          <p className="mt-0.5 text-[11px] text-line-400">소개: {guest.referrer.nickname}</p>
        )}
        {guest.notes && (
          <p className="mt-1 text-[11px] text-line-400">{guest.notes}</p>
        )}

        {/* 정회원 전환 */}
        {!guest.converted_to_member_id && !isInactive && (
          <div className="mt-3">
            <ConvertGuestButton
              guestId={guest.id}
              guestName={guest.name}
              suggestedGrade={guest.skill_grade}
              guestPhone={guest.phone}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 공개 목록 (기존 /guests 유지) ────────────────────────────────────
function PublicGuestList({ guests }: { guests: GuestWithReferrer[] }) {
  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-line-200 bg-line-50 p-6 text-center text-sm text-line-400">
        등록된 게스트가 없어요.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {guests.map((guest) => (
        <div key={guest.id} className="rounded-lg border border-line-200 bg-line-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-line-900">{guest.name}</span>
            <span className="text-xs text-line-400">{guest.visit_date}</span>
          </div>
          <p className="mt-1 text-xs text-line-500">
            {[
              guest.age !== null && `${guest.age}세`,
              guest.years_playing !== null && `구력 ${guest.years_playing}년`,
              guest.phone,
            ].filter(Boolean).join(" · ")}
          </p>
          {(guest.wins > 0 || guest.losses > 0) && (
            <p className="mt-1 text-xs text-line-500">
              {guest.wins}승 {guest.losses}패 · 승률 {guest.win_rate}%
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between text-xs text-line-500">
            <span>소개자: {guest.referrer?.nickname ?? "없음"}</span>
            {guest.manner_score !== null && <span>매너 {guest.manner_score}/5</span>}
          </div>
          {guest.notes && <p className="mt-1.5 text-xs text-line-400">{guest.notes}</p>}
          {guest.converted_to_member_id && (
            <p className="mt-2 text-xs font-semibold text-clay-400">
              ✓ 정회원으로 전환됨 ({guest.converted_member?.nickname ?? "회원"})
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
