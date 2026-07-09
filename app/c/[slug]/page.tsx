import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * /c/[slug] — 클럽 공개 홈
 *
 * slug로 clubs 테이블에서 active 클럽을 조회해 표시한다.
 * 경기/랭킹/회원/출석 기능은 기존 최상위 라우트(/matches 등)로 연결한다.
 */
export const dynamic = "force-dynamic";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
}

async function getClubBySlug(slug: string): Promise<Club | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

export default async function ClubHomePage({
  params,
}: {
  params: { slug: string };
}) {
  const club = await getClubBySlug(params.slug);
  if (!club) notFound();

  const navItems = [
    { href: "/matches",    label: "경기 기록",  sub: "Match results" },
    { href: "/ranking",    label: "랭킹",       sub: "Rankings" },
    { href: "/members",    label: "회원",        sub: "Members" },
    { href: "/attendance", label: "출석",        sub: "Attendance" },
  ];

  return (
    <main className="px-4 pt-8 pb-28">
      {/* ── 클럽 헤더 ──────────────────────────────── */}
      <header className="mb-8">
        <div className="mb-1.5 inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-clay-400" />
          <p className="eyebrow-en text-clay-400">{club.slug}</p>
        </div>
        <h1 className="headline-kr text-4xl text-line-900 mb-1">
          {club.name}
        </h1>
        {club.description && (
          <p className="mt-1 max-w-[260px] break-keep text-xs leading-relaxed text-line-500">
            {club.description}
          </p>
        )}
      </header>

      {/* ── 주요 기능 네비게이션 ─────────────────────── */}
      <section className="mb-8">
        <p className="eyebrow-en text-line-400 mb-3 text-[10px]">
          Club Features
        </p>
        <div className="grid grid-cols-2 gap-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-4 transition-colors hover:border-clay-400/30 hover:bg-white"
            >
              <p className="text-sm font-bold text-line-900 mb-0.5">
                {item.label}
              </p>
              <p className="text-[10px] text-line-400">{item.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 뒤로 가기 ──────────────────────────────── */}
      <div className="text-center">
        <Link
          href="/"
          className="text-xs text-line-400 hover:text-line-600 transition-colors"
        >
          ← 클럽 목록으로
        </Link>
      </div>
    </main>
  );
}
