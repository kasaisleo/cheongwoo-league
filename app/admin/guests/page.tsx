import Link from "next/link";
import { GuestList } from "@/components/guest/GuestList";

/**
 * /admin/guests — 관리자 게스트 관리 화면.
 *
 * - 데이터/쿼리: GuestList(mode="admin") — 기존 guest_stats 뷰 그대로 사용
 * - 권한: layout.tsx requireAdminAccess()
 * - 등록: /guests/new (기존 등록 플로우 유지)
 */
export default function AdminGuestsPage() {
  return (
    <main className="px-4 pt-6 pb-28">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Guests</p>
          <h1 className="headline-kr text-4xl text-line-900">게스트 관리</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      <p className="mb-5 text-sm text-line-500">
        방문 게스트 목록을 확인하고 정회원으로 전환합니다.
      </p>

      {/* 게스트 등록 버튼 */}
      <div className="mb-5">
        <Link href="/guests/new"
          className="inline-flex items-center gap-1.5 rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-2 text-sm font-semibold text-clay-400 hover:bg-clay-400/20">
          + 게스트 등록
        </Link>
      </div>

      {/* 게스트 목록 — 기존 쿼리/데이터 재사용, 관리자 디자인 적용 */}
      <GuestList mode="admin" />
    </main>
  );
}
