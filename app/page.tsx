import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * SUPER MATCH — 플랫폼 메인 랜딩
 *
 * - clubs 테이블에서 status='active' 클럽만 공개 조회
 * - getCurrentClubId / getCurrentClub / selected_club_id / DEFAULT_CLUB_ID 미사용
 * - 공개 페이지 — 인증 없이 접근 가능
 */
export const dynamic = "force-dynamic";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
}

async function getActiveClubs(): Promise<Club[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export default async function PlatformLandingPage() {
  const clubs = await getActiveClubs();

  return (
    <main className="px-4 pt-8 pb-28">
      {/* ── 히어로 ─────────────────────────────────── */}
      <header className="mb-8">
        <p className="eyebrow-en text-clay-400 mb-2">Super Match</p>
        <h1 className="headline-kr text-[28px] text-line-900 mb-2 leading-tight">
          Find your club.
          <br />
          Enter the court.
        </h1>
        <p className="text-sm text-line-500 leading-relaxed">
          테니스 클럽을 선택해 입장하세요.
        </p>
      </header>

      {/* ── 클럽 목록 ───────────────────────────────── */}
      <section className="mb-10">
        <p className="eyebrow-en text-line-400 mb-3 text-[10px]">
          Choose Your Club
        </p>

        {clubs.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 px-5 py-8 text-center">
            <p className="text-sm text-line-400">
              현재 운영 중인 클럽이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
      </section>

      {/* ── CREATE A CLUB CTA ────────────────────────── */}
      <section>
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 px-5 py-5">
          <p className="eyebrow-en text-clay-400 mb-2 text-[10px]">
            Create a Club
          </p>
          <p className="text-sm font-semibold text-line-900 mb-1">
            나만의 클럽을 열고 싶으신가요?
          </p>
          <p className="text-xs text-line-500 leading-relaxed mb-4">
            클럽 개설을 원하시면 운영자에게 문의하세요.
          </p>
          <span
            className="inline-block rounded-lg border border-line-200/60 bg-line-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-line-400 cursor-not-allowed"
            aria-disabled="true"
          >
            Coming Soon
          </span>
        </div>
      </section>

      {/* ── Operator footer ─────────────────────────── */}
      <div className="mt-10 text-center">
        <Link
          href="/center-court"
          className="text-[10px] text-line-300 hover:text-line-400 transition-colors"
        >
          Operator ↗
        </Link>
      </div>
    </main>
  );
}

/* ── Club Card ────────────────────────────────────── */
function ClubCard({ club }: { club: Club }) {
  return (
    <Link
      href={`/c/${club.slug}`}
      className="block rounded-[14px] border border-line-200/40 bg-line-50 transition-colors hover:border-clay-400/30 hover:bg-white"
    >
      <div className="relative overflow-hidden rounded-[14px] px-5 py-4">
        {/* 왼쪽 accent bar */}
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-[14px] bg-clay-400/50" />

        <div className="pl-3">
          <p className="text-[13px] font-bold text-line-900 mb-0.5">
            {club.name}
          </p>
          {club.description && (
            <p className="text-xs text-line-500 leading-relaxed mb-2 line-clamp-2">
              {club.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] text-line-300 font-mono">
              /c/{club.slug}
            </span>
            <span className="eyebrow-en text-[9px] text-clay-400 border border-clay-400/40 rounded px-2 py-0.5">
              Enter Club →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
