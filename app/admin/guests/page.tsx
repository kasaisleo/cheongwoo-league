import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { GuestList } from "@/components/guest/GuestList";

/**
 * /admin/guests — 관리자 게스트 관리 화면.
 *
 * club_id는 admin_club_slug 쿠키 → getAdminAccessServer().clubId 경로로만 결정.
 * selected_club_id / getCurrentClubId() 사용 금지.
 * layout.tsx가 requireAdminAccess()를 이미 호출하므로 여기서는 clubId만 추가로 확인.
 */
export default async function AdminGuestsPage() {
  const access = await getAdminAccessServer();
  if (!access.isAdmin || !access.clubId) redirect("/admin?reason=no_club");
  const clubId = access.clubId;

  return (
    <main className="px-4 pt-6 pb-28">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Guests</p>
          <h1 className="headline-kr text-4xl text-line-900">게스트 관리</h1>
        </div>
        <Link href="/admin"
          className="flex-shrink-0 whitespace-nowrap rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-5 max-w-[280px] break-keep text-xs leading-relaxed text-line-500">게스트 목록 확인 및 정회원 전환.</p>

      <div className="mb-5">
        <Link href="/admin/guests/new"
          className="inline-flex items-center gap-1.5 rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-2 text-sm font-semibold text-clay-400 hover:bg-clay-400/20">
          + 게스트 등록
        </Link>
      </div>

      <GuestList mode="admin" clubId={clubId} />
    </main>
  );
}
