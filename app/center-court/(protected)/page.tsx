import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminAccessServer } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
}

async function getCenterCourtData() {
  const supabase = createClient();

  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status")
    .order("created_at", { ascending: true });

  const allClubs: Club[] = clubs ?? [];
  const activeClubs = allClubs.filter((c) => c.status === "active");
  const inactiveClubs = allClubs.filter((c) => c.status !== "active");

  return { allClubs, activeClubs, inactiveClubs };
}

export default async function CenterCourtPage() {
  const [access, data] = await Promise.all([
    getPlatformAdminAccessServer(),
    getCenterCourtData(),
  ]);

  const { allClubs, activeClubs, inactiveClubs } = data;

  return (
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Center Court</p>
          <h1 className="headline-kr text-4xl text-line-900">센터코트</h1>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-sm border border-clay-400/30 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400">
            {access.role === "owner"
              ? "Platform Owner"
              : access.role === "analyst"
                ? "Analyst"
                : "Platform Admin"}
          </span>
          {access.username && (
            <span className="text-[10px] text-line-400">{access.username}</span>
          )}
        </div>
      </header>

      {/* ── 플랫폼 현황 ──────────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Platform Overview
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-3 divide-x divide-line-200/30">
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-900">
                {allClubs.length}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                전체 클럽
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-gold">
                {activeClubs.length}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                운영 중
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-400">
                {inactiveClubs.length}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                비활성
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 클럽 목록 ────────────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Clubs
        </p>

        {allClubs.length === 0 ? (
          <div className="rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-6 text-center">
            <p className="text-sm text-line-400">등록된 클럽이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            {allClubs.map((club, idx) => (
              <div
                key={club.id}
                className={`px-4 py-3 ${
                  idx < allClubs.length - 1
                    ? "border-b border-line-200/30"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-line-900">
                        {club.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          club.status === "active"
                            ? "border border-gold/30 bg-gold/10 text-gold"
                            : "border border-line-200/40 bg-line-100 text-line-400"
                        }`}
                      >
                        {club.status}
                      </span>
                    </div>
                    {club.description && (
                      <p className="mt-0.5 truncate text-[10px] text-line-500">
                        {club.description}
                      </p>
                    )}
                    <p className="mt-1 font-display text-[9px] font-bold tracking-wide text-line-400">
                      /c/{club.slug || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 예정 기능 안내 ───────────────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Coming Soon
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {[
            { label: "클럽 생성", sub: "New Club · /c/[slug] 활성화" },
            { label: "클럽 상태 관리", sub: "Active / Inactive / Suspended" },
            { label: "사용량 분석", sub: "Analytics · 활성도 · 데이터" },
            { label: "플랫폼 설정", sub: "Platform Settings" },
          ].map((item, idx, arr) => (
            <div
              key={item.label}
              className={`flex items-center justify-between px-4 py-3 ${
                idx < arr.length - 1 ? "border-b border-line-200/30" : ""
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-line-400">
                  {item.label}
                </p>
                <p className="text-[10px] text-line-300">{item.sub}</p>
              </div>
              <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-line-400">
                예정
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
