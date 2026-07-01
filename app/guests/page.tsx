import Link from "next/link";
import { isAdminSession } from "@/lib/admin-auth";
import { Button } from "@/components/ui/Button";
import { GuestList } from "@/components/guest/GuestList";

export default async function GuestsPage() {
  const isAdmin = isAdminSession();

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Guests
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
            게스트 관리
          </h1>
        </div>
        <Link href="/guests/new">
          <Button size="md">+ 게스트 등록</Button>
        </Link>
      </header>

      <GuestList mode="public" />
    </main>
  );
}
