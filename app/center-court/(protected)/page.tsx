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
  const isOwner = session?.role === "owner";

  return (
    /* 와이드 화면 2컬럼 레이아웃 */
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 24,
        alignItems: "start",
      }}
      className="lg:grid-cols-[1fr_260px]"
    >
      {/* ════════════ 왼쪽 : 메인 콘텐츠 ════════════ */}
      <div>
        {/* 페이지 헤더 */}
        <div style={{ marginBottom: 28 }}>
          <ScoreboardLabel>Platform Overview</ScoreboardLabel>
          <h1
            style={{
              color: "#f5f0e8",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.15,
            }}
          >
            Dashboard
          </h1>
        </div>

        {/* 플랫폼 현황 스탯 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <StatPanel label="전체 클럽" value={allClubs.length} />
          <StatPanel label="운영 중"   value={activeClubs.length}  accent />
          <StatPanel label="비활성"    value={inactiveClubs.length} dim />
        </div>

        {/* Owner: Platform Admins 바로가기 카드 */}
        {isOwner && (
          <Link
            href="/center-court/platform-admins"
            style={{ display: "block", textDecoration: "none", marginBottom: 20 }}
          >
            <div
              className="cc-card"
              style={{
                borderRadius: 13,
                border: "1px solid rgba(109,40,217,0.45)",
                background: "rgba(2,4,3,0.92)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                boxShadow:
                  "0 0 0 0 transparent, 0 4px 22px rgba(0,0,0,0.6), inset 3px 0 0 rgba(109,40,217,0.55)",
              }}
            >
              <div>
                <p
                  style={{
                    color: "#c4b5fd",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}
                >
                  Platform Admins
                </p>
                <p style={{ color: "rgba(245,240,232,0.38)", fontSize: 11 }}>
                  관리자 계정 생성 · 수정 · 권한 관리
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M5 3l4 4-4 4"
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
        <section style={{ marginBottom: 20 }}>
          <ScoreboardLabel>Clubs</ScoreboardLabel>
          {allClubs.length === 0 ? (
            <CourtPanel>
              <p
                style={{
                  color: "rgba(245,240,232,0.3)",
                  fontSize: 13,
                  textAlign: "center",
                  padding: "20px 16px",
                }}
              >
                등록된 클럽이 없습니다.
              </p>
            </CourtPanel>
          ) : (
            <CourtPanel>
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
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          color: "#f0ebe0",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {club.name}
                      </span>
                      <StatusPill status={club.status} />
                    </div>
                    {club.description && (
                      <p
                        style={{
                          color: "rgba(245,240,232,0.32)",
                          fontSize: 10,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 220,
                        }}
                      >
                        {club.description}
                      </p>
                    )}
                    <p
                      style={{
                        color: "rgba(245,240,232,0.22)",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        marginTop: 3,
                      }}
                    >
                      /c/{club.slug || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </CourtPanel>
          )}
        </section>
      </div>

      {/* ════════════ 오른쪽 : ORDER OF PLAY 패널 ════════════ */}
      <aside style={{ display: "contents" }} className="lg:block">
        <div className="hidden lg:block">
          <OrderOfPlay />
        </div>
      </aside>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ORDER OF PLAY 사이드 패널
   ════════════════════════════════════════════════════════════ */
function OrderOfPlay() {
  const items = [
    { time: "Q1", label: "클럽 생성 플로우",  sub: "New Club · /c/[slug]",         status: "scheduled" },
    { time: "Q2", label: "클럽 상태 관리",    sub: "Active / Inactive / Suspended", status: "scheduled" },
    { time: "Q3", label: "사용량 분석",        sub: "Analytics · 활성도",           status: "not_started" },
    { time: "Q4", label: "플랫폼 설정",        sub: "Platform Settings",             status: "not_started" },
  ];

  return (
    <div>
      {/* 스코어보드 스타일 헤더 */}
      <div
        style={{
          borderRadius: "11px 11px 0 0",
          background:
            "linear-gradient(135deg, rgba(70,20,150,0.55) 0%, rgba(30,8,60,0.70) 100%)",
          border: "1px solid rgba(139,92,246,0.45)",
          borderBottom: "1px solid rgba(139,92,246,0.2)",
          padding: "10px 16px 9px",
          boxShadow: "inset 0 1px 0 rgba(196,181,253,0.12)",
        }}
      >
        <p
          style={{
            color: "#c4b5fd",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Order of Play
        </p>
        <p
          style={{
            color: "rgba(245,240,232,0.3)",
            fontSize: 9,
            letterSpacing: "0.08em",
            marginTop: 1,
          }}
        >
          Platform Roadmap
        </p>
      </div>

      {/* 항목 목록 */}
      <div
        style={{
          border: "1px solid rgba(139,92,246,0.3)",
          borderTop: "none",
          borderRadius: "0 0 11px 11px",
          overflow: "hidden",
          boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.label}
            style={{
              padding: "10px 16px",
              borderBottom:
                idx < items.length - 1
                  ? "1px solid rgba(245,240,232,0.055)"
                  : "none",
              background:
                idx % 2 === 0
                  ? "rgba(2,6,4,0.92)"
                  : "rgba(4,10,7,0.88)",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            {/* 타임 슬롯 */}
            <span
              style={{
                color: "rgba(196,181,253,0.5)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                fontFamily: "Georgia, serif",
                flexShrink: 0,
                marginTop: 1,
                width: 20,
              }}
            >
              {item.time}
            </span>
            {/* 내용 */}
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  color: "rgba(245,240,232,0.55)",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  marginBottom: 1,
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  color: "rgba(245,240,232,0.22)",
                  fontSize: 9.5,
                  letterSpacing: "0.02em",
                }}
              >
                {item.sub}
              </p>
            </div>
            {/* 상태 dot */}
            <div
              style={{
                flexShrink: 0,
                marginTop: 4,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  item.status === "scheduled"
                    ? "rgba(196,181,253,0.5)"
                    : "rgba(245,240,232,0.15)",
              }}
            />
          </div>
        ))}
      </div>

      {/* 플랫폼 정보 패널 */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 11,
          border: "1px solid rgba(245,240,232,0.10)",
          background: "rgba(2,6,4,0.88)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "12px 16px",
          boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
        }}
      >
        <p
          style={{
            color: "rgba(245,240,232,0.25)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Platform Info
        </p>
        {[
          { label: "Auth",     value: "platform_admin_session" },
          { label: "DB",       value: "Supabase (service_role)" },
          { label: "Session",  value: "SHA-256 token hash" },
          { label: "Password", value: "scrypt · 64-byte key" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              paddingBottom: 5,
              marginBottom: 5,
              borderBottom: "1px solid rgba(245,240,232,0.04)",
            }}
          >
            <span
              style={{
                color: "rgba(245,240,232,0.28)",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                color: "rgba(245,240,232,0.45)",
                fontSize: 9,
                textAlign: "right",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   공통 서브 컴포넌트
   ════════════════════════════════════════════════════════════ */

function ScoreboardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "rgba(196,181,253,0.45)",
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: 9,
        fontFamily: "Georgia, serif",
      }}
    >
      {children}
    </p>
  );
}

function StatPanel({
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
  const valueColor = accent
    ? "#b197fc"
    : dim
      ? "rgba(245,240,232,0.4)"
      : "#f5f0e8";
  const borderColor = accent
    ? "rgba(139,92,246,0.40)"
    : "rgba(245,240,232,0.10)";
  const glowShadow = accent
    ? "0 0 18px rgba(109,40,217,0.2)"
    : "0 4px 20px rgba(0,0,0,0.55)";

  return (
    <div
      className="cc-card"
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        background: "rgba(2,6,4,0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "13px 14px",
        boxShadow: glowShadow,
      }}
    >
      <p
        style={{
          color: valueColor,
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1,
          marginBottom: 5,
          fontFamily: "Georgia, serif",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      <p
        style={{
          color: "rgba(245,240,232,0.38)",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function CourtPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 13,
        border: "1px solid rgba(245,240,232,0.12)",
        background: "rgba(2,6,4,0.90)",
        overflow: "hidden",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      style={{
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "1px 6px",
        borderRadius: 3,
        background: active
          ? "rgba(134,239,172,0.1)"
          : "rgba(245,240,232,0.05)",
        border: active
          ? "1px solid rgba(134,239,172,0.22)"
          : "1px solid rgba(245,240,232,0.09)",
        color: active ? "#86efac" : "rgba(245,240,232,0.28)",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}
