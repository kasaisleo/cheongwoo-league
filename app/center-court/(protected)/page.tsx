import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";

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
  const all: Club[] = clubs ?? [];
  return {
    allClubs: all,
    activeClubs: all.filter((c) => c.status === "active"),
    inactiveClubs: all.filter((c) => c.status !== "active"),
  };
}

export default async function CenterCourtPage() {
  const [session, data] = await Promise.all([
    getPlatformAdminSession(),
    getCenterCourtData(),
  ]);
  const { allClubs, activeClubs, inactiveClubs } = data;

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div className="mb-7">
        <p
          style={{
            color: "rgba(245,240,232,0.35)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Platform Overview
        </p>
        <h1
          style={{
            color: "#f5f0e8",
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          Dashboard
        </h1>
      </div>

      {/* 플랫폼 현황 카드 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="전체 클럽" value={allClubs.length} />
        <StatCard label="운영 중" value={activeClubs.length} accent />
        <StatCard label="비활성" value={inactiveClubs.length} dim />
      </div>

      {/* Owner 전용: Platform Admins 링크 카드 */}
      {session?.role === "owner" && (
        <Link href="/center-court/platform-admins" style={{ display: "block", textDecoration: "none", marginBottom: 20 }}>
          <div
            className="cc-card"
            style={{
              borderRadius: 14,
              border: "1px solid rgba(139,92,246,0.25)",
              background: "rgba(139,92,246,0.08)",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  color: "#c4b5fd",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                Platform Admins
              </p>
              <p style={{ color: "rgba(245,240,232,0.4)", fontSize: 11 }}>
                관리자 계정 생성 · 수정 · 권한 관리
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3l5 5-5 5"
                stroke="rgba(196,181,253,0.6)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Link>
      )}

      {/* 클럽 목록 */}
      <section className="mb-5">
        <SectionLabel>Clubs</SectionLabel>
        {allClubs.length === 0 ? (
          <CourtCard>
            <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 13, textAlign: "center" }}>
              등록된 클럽이 없습니다.
            </p>
          </CourtCard>
        ) : (
          <CourtCard>
            {allClubs.map((club, idx) => (
              <div
                key={club.id}
                style={{
                  padding: "11px 16px",
                  borderBottom:
                    idx < allClubs.length - 1
                      ? "1px solid rgba(245,240,232,0.06)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ color: "#f5f0e8", fontSize: 13, fontWeight: 600 }}>
                      {club.name}
                    </span>
                    <StatusBadge status={club.status} />
                  </div>
                  {club.description && (
                    <p
                      style={{
                        color: "rgba(245,240,232,0.35)",
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 200,
                      }}
                    >
                      {club.description}
                    </p>
                  )}
                  <p
                    style={{
                      color: "rgba(245,240,232,0.25)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      marginTop: 2,
                    }}
                  >
                    /c/{club.slug || "—"}
                  </p>
                </div>
              </div>
            ))}
          </CourtCard>
        )}
      </section>

      {/* Coming soon */}
      <section>
        <SectionLabel>Coming Soon</SectionLabel>
        <CourtCard>
          {[
            { label: "클럽 생성", sub: "New Club · /c/[slug] 활성화" },
            { label: "클럽 상태 관리", sub: "Active / Inactive / Suspended" },
            { label: "사용량 분석", sub: "Analytics · 활성도 · 데이터" },
            { label: "플랫폼 설정", sub: "Platform Settings" },
          ].map((item, idx, arr) => (
            <div
              key={item.label}
              style={{
                padding: "11px 16px",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid rgba(245,240,232,0.06)"
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 13, fontWeight: 600 }}>
                  {item.label}
                </p>
                <p style={{ color: "rgba(245,240,232,0.2)", fontSize: 10 }}>{item.sub}</p>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 4,
                  border: "1px solid rgba(245,240,232,0.12)",
                  color: "rgba(245,240,232,0.25)",
                }}
              >
                예정
              </span>
            </div>
          ))}
        </CourtCard>
      </section>
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  dim,
}: {
  label: string;
  value: number;
  accent?: boolean;
  dim?: boolean;
}) {
  const valueColor = accent ? "#a78bfa" : dim ? "rgba(245,240,232,0.3)" : "#f5f0e8";
  return (
    <div
      className="cc-card"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(245,240,232,0.10)",
        background: "rgba(245,240,232,0.04)",
        padding: "12px 14px",
      }}
    >
      <p style={{ color: valueColor, fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </p>
      <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "rgba(245,240,232,0.3)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function CourtCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(245,240,232,0.10)",
        background: "rgba(245,240,232,0.04)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "1px 6px",
        borderRadius: 3,
        background: active ? "rgba(134,239,172,0.12)" : "rgba(245,240,232,0.06)",
        border: active ? "1px solid rgba(134,239,172,0.25)" : "1px solid rgba(245,240,232,0.10)",
        color: active ? "#86efac" : "rgba(245,240,232,0.3)",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}
