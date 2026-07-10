import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { GuestList } from "@/components/guest/GuestList";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <AdminPageHeader
        title="게스트 관리"
        description="게스트 목록 확인 및 정회원 전환."
        backHref="/admin"
      />

      <div className="mb-5">
        <Link
          href="/admin/guests/new"
          className="inline-flex items-center gap-1.5 rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold transition-colors hover:bg-[color:var(--admin-accent-soft)]"
          style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
        >
          + 게스트 등록
        </Link>
      </div>

      <GuestList mode="admin" clubId={clubId} />
    </main>
  );
}
