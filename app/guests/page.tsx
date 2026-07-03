import Link from "next/link";
import { isAdminSession } from "@/lib/admin-auth";
import { Button } from "@/components/ui/Button";
import { GuestList } from "@/components/guest/GuestList";

// 게스트 등록 직후 목록이 최신 상태로 보이도록 이 페이지는 항상 동적 렌더링한다.
// (등록 → /guests 이동 시 캐시된 결과가 먼저 보이는 문제 방지)
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
