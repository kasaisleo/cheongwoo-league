import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";

export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */
interface ClubRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface AdminRow {
  id: string;
  status: string;
}

interface RecentAuditRow {
  id: string;
  action: string;
  target_label: string | null;
  platform_admin_username: string;
  created_at: string;
}

interface DashboardData {
  clubs: ClubRow[] | null;
  clubsError: boolean;
  admins: AdminRow[] | null;
  adminsError: boolean;
  auditCount24h: number | null;
  auditCountError: boolean;
  recentAudit: RecentAuditRow[] | null;
  recentAuditError: boolean;
}

/* ────────────────────────────────────────────────────────────
   Data fetching — all queries run in parallel, failures are
   isolated so one bad query never kills the whole dashboard.
   ──────────────────────────────────────────────────────────── */
async function getDashboardData(): Promise<DashboardData> {
  const supabase = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [clubsRes, adminsRes, auditCountRes, recentAuditRes] =
    await Promise.allSettled([
      supabase
        .from("clubs")
        .select("id, name, slug, status, created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("platform_admins")
        .select("id, status"),

      supabase
        .from("platform_audit_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h),

      supabase
        .from("platform_audit_logs")
        .select("id, action, target_label, platform_admin_username, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const clubsErr = clubsRes.status === "rejected" || (clubsRes.status === "fulfilled" && !!clubsRes.value.error);
  const adminsErr = adminsRes.status === "rejected" || (adminsRes.status === "fulfilled" && !!adminsRes.value.error);
  const auditCntErr = auditCountRes.status === "rejected" || (auditCountRes.status === "fulfilled" && !!auditCountRes.value.error);
  const recentAuditErr = recentAuditRes.status === "rejected" || (recentAuditRes.status === "fulfilled" && !!recentAuditRes.value.error);

  if (clubsErr) {
    const err = clubsRes.status === "rejected" ? clubsRes.reason : (clubsRes.status === "fulfilled" ? clubsRes.value.error : null);
    console.error("[dashboard] clubs query failed", { error: (err as { message?: string })?.message ?? err });
  }
  if (adminsErr) {
    const err = adminsRes.status === "rejected" ? adminsRes.reason : (adminsRes.status === "fulfilled" ? adminsRes.value.error : null);
    console.error("[dashboard] admins query failed", { error: (err as { message?: string })?.message ?? err });
  }
  if (auditCntErr) {
    const err = auditCountRes.status === "rejected" ? auditCountRes.reason : (auditCountRes.status === "fulfilled" ? auditCountRes.value.error : null);
    console.error("[dashboard] audit count query failed", { error: (err as { message?: string })?.message ?? err });
  }
  if (recentAuditErr) {
    const err = recentAuditRes.status === "rejected" ? recentAuditRes.reason : (recentAuditRes.status === "fulfilled" ? recentAuditRes.value.error : null);
    console.error("[dashboard] recent audit query failed", { error: (err as { message?: string })?.message ?? err });
  }

  return {
    clubs:
      clubsRes.status === "fulfilled" && !clubsRes.value.error
        ? (clubsRes.value.data as unknown as ClubRow[])
        : null,
    clubsError: clubsErr,

    admins:
      adminsRes.status === "fulfilled" && !adminsRes.value.error
        ? (adminsRes.value.data as unknown as AdminRow[])
        : null,
    adminsError: adminsErr,

    auditCount24h:
      auditCountRes.status === "fulfilled" && !auditCountRes.value.error
        ? (auditCountRes.value.count ?? 0)
        : null,
    auditCountError: auditCntErr,

    recentAudit:
      recentAuditRes.status === "fulfilled" && !recentAuditRes.value.error
        ? (recentAuditRes.value.data as unknown as RecentAuditRow[])
        : null,
    recentAuditError: recentAuditErr,
  };
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */
export default async function CenterCourtPage() {
  const [session, data] = await Promise.all([
    getPlatformAdminSession(),
    getDashboardData(),
  ]);

  const {
    clubs,
    clubsError,
    admins,
    adminsError,
    auditCount24h,
    auditCountError,
    recentAudit,
    recentAuditError,
  } = data;

  // Club stats
  const totalClubs    = clubs?.length ?? 0;
  const activeClubs   = clubs?.filter((c) => c.status === "active").length ?? 0;
  const inactiveClubs = clubs ? totalClubs - activeClubs : 0;

  // Admin stats
  const totalAdmins  = admins?.length ?? 0;
  const activeAdmins = admins?.filter((a) => a.status === "active").length ?? 0;

  // Recent clubs (top 5, ordered by created_at desc)
  const recentClubs = clubs?.slice(0, 5) ?? [];

  const isOwner = session?.role === "owner";

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, alignItems: "start" }}
      className="lg:grid-cols-[1fr_260px]"
    >
      {/* ════ 왼쪽 : 메인 콘텐츠 ════ */}
      <div>
        {/* 헤더 */}
        <div style={{ marginBottom: 28 }}>
          <ScoreboardLabel>Platform Overview</ScoreboardLabel>
          <h1
            style={{
              color: "#f5f0e8",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.15,
            }}
          >
            Dashboard
          </h1>
        </div>

        {/* ── Stat Cards Row 1: Clubs ── */}
        <ScoreboardLabel>Clubs</ScoreboardLabel>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}
        >
          {clubsError ? (
            <ErrorStat label="Total Clubs" />
          ) : (
            <StatPanel label="Total Clubs" value={totalClubs} />
          )}
          {clubsError ? (
            <ErrorStat label="Active" accent />
          ) : (
            <StatPanel label="Active" value={activeClubs} accent />
          )}
          {clubsError ? (
            <ErrorStat label="Inactive" dim />
          ) : (
            <StatPanel label="Inactive" value={inactiveClubs} dim />
          )}
        </div>

        {/* ── Stat Cards Row 2: Admins + Audit ── */}
        <ScoreboardLabel>Platform Admins &amp; Activity</ScoreboardLabel>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}
        >
          {adminsError ? (
            <ErrorStat label="Total Admins" />
          ) : (
            <StatPanel label="Total Admins" value={totalAdmins} />
          )}
          {adminsError ? (
            <ErrorStat label="Active Admins" accent />
          ) : (
            <StatPanel label="Active Admins" value={activeAdmins} accent />
          )}
          {auditCountError ? (
            <ErrorStat label="Audit (24h)" />
          ) : (
            <StatPanel label="Audit (24h)" value={auditCount24h ?? 0} amber />
          )}
        </div>

        {/* ── 최근 생성 클럽 5개 ── */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <ScoreboardLabel>Recent Clubs</ScoreboardLabel>
            <Link
              href="/center-court/clubs"
              style={{ color: "rgba(196,181,253,0.55)", fontSize: 9, letterSpacing: "0.12em", textDecoration: "none", fontWeight: 700, textTransform: "uppercase" }}
            >
              View All →
            </Link>
          </div>
          {clubsError ? (
            <CourtPanel>
              <SectionError />
            </CourtPanel>
          ) : recentClubs.length === 0 ? (
            <CourtPanel>
              <EmptyNote>No clubs registered.</EmptyNote>
            </CourtPanel>
          ) : (
            <CourtPanel>
              {recentClubs.map((club, idx) => (
                <div
                  key={club.id}
                  style={{
                    padding: "11px 16px",
                    borderBottom: idx < recentClubs.length - 1 ? "1px solid rgba(245,240,232,0.06)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ color: "#f0ebe0", fontSize: 13, fontWeight: 600 }}>
                        {club.name}
                      </span>
                      <StatusPill status={club.status} />
                    </div>
                    <p style={{ color: "rgba(245,240,232,0.22)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", marginTop: 2 }}>
                      /c/{club.slug || "—"}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{ color: "rgba(245,240,232,0.22)", fontSize: 9, letterSpacing: "0.04em" }}>
                      {formatRelative(club.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </CourtPanel>
          )}
        </section>

        {/* ── Quick Links (모바일에서는 하단 노출) ── */}
        <div className="lg:hidden">
          <QuickLinks isOwner={isOwner} />
        </div>
      </div>

      {/* ════ 오른쪽 : 사이드바 ════ */}
      <aside>
        <div className="hidden lg:block">
          {/* 최근 감사 로그 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <ScoreboardLabel>Recent Audit Log</ScoreboardLabel>
              <Link
                href="/center-court/audit"
                style={{ color: "rgba(196,181,253,0.55)", fontSize: 9, letterSpacing: "0.12em", textDecoration: "none", fontWeight: 700, textTransform: "uppercase" }}
              >
                View All →
              </Link>
            </div>

            {recentAuditError ? (
              <div
                style={{
                  borderRadius: 11,
                  border: "1px solid rgba(245,240,232,0.10)",
                  background: "rgba(2,6,4,0.88)",
                  padding: "14px 16px",
                }}
              >
                <SectionError />
              </div>
            ) : !recentAudit || recentAudit.length === 0 ? (
              <div
                style={{
                  borderRadius: 11,
                  border: "1px solid rgba(245,240,232,0.10)",
                  background: "rgba(2,6,4,0.88)",
                  padding: "14px 16px",
                }}
              >
                <EmptyNote>No audit logs yet.</EmptyNote>
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 11,
                  border: "1px solid rgba(245,240,232,0.10)",
                  background: "rgba(2,6,4,0.90)",
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
                }}
              >
                {recentAudit.map((log, idx) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: idx < recentAudit.length - 1 ? "1px solid rgba(245,240,232,0.05)" : "none",
                      background: idx % 2 === 0 ? "rgba(2,6,4,0.92)" : "rgba(4,10,7,0.88)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <ActionBadge action={log.action} />
                    </div>
                    <p style={{ color: "rgba(245,240,232,0.65)", fontSize: 10, fontWeight: 500, marginBottom: 2 }}>
                      {log.target_label ?? "—"}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ color: "rgba(245,240,232,0.28)", fontSize: 9 }}>
                        {log.platform_admin_username}
                      </span>
                      <span style={{ color: "rgba(245,240,232,0.20)", fontSize: 9 }}>
                        {formatRelative(log.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <QuickLinks isOwner={isOwner} />

          {/* Platform Info */}
          <PlatformInfo />
        </div>
      </aside>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Quick Links
   ──────────────────────────────────────────────────────────── */
function QuickLinks({ isOwner }: { isOwner: boolean }) {
  const links = [
    {
      href: "/center-court/clubs",
      label: "Club Registry",
      sub: "Create · Edit · Status",
      color: "rgba(134,239,172,0.55)",
      border: "rgba(134,239,172,0.25)",
      inset: "rgba(134,239,172,0.35)",
    },
    ...(isOwner
      ? [
          {
            href: "/center-court/platform-admins",
            label: "Platform Admins",
            sub: "Create · Edit · Roles",
            color: "rgba(196,181,253,0.55)",
            border: "rgba(109,40,217,0.35)",
            inset: "rgba(109,40,217,0.45)",
          },
        ]
      : []),
    {
      href: "/center-court/audit",
      label: "Audit Log",
      sub: "Platform action history",
      color: "rgba(251,191,36,0.55)",
      border: "rgba(251,191,36,0.18)",
      inset: "rgba(251,191,36,0.30)",
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <ScoreboardLabel>Quick Access</ScoreboardLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ display: "block", textDecoration: "none" }}
          >
            <div
              className="cc-card"
              style={{
                borderRadius: 11,
                border: `1px solid ${link.border}`,
                background: "rgba(2,4,3,0.92)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                padding: "11px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxShadow: `0 4px 18px rgba(0,0,0,0.5), inset 3px 0 0 ${link.inset}`,
              }}
            >
              <div>
                <p style={{ color: link.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  {link.label}
                </p>
                <p style={{ color: "rgba(245,240,232,0.28)", fontSize: 9.5 }}>
                  {link.sub}
                </p>
              </div>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="rgba(245,240,232,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Platform Info (static)
   ──────────────────────────────────────────────────────────── */
function PlatformInfo() {
  return (
    <div
      style={{
        borderRadius: 11,
        border: "1px solid rgba(245,240,232,0.10)",
        background: "rgba(2,6,4,0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "12px 16px",
        boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ color: "rgba(245,240,232,0.25)", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
        Platform Info
      </p>
      {[
        { label: "Auth",     value: "platform_admin_session" },
        { label: "Database", value: "Supabase (service_role)" },
        { label: "Access",   value: "SHA-256 token hash" },
        { label: "Password", value: "scrypt · 64-byte key" },
      ].map((row) => (
        <div
          key={row.label}
          style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingBottom: 5, marginBottom: 5, borderBottom: "1px solid rgba(245,240,232,0.04)" }}
        >
          <span style={{ color: "rgba(245,240,232,0.28)", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
            {row.label}
          </span>
          <span style={{ color: "rgba(245,240,232,0.45)", fontSize: 9, textAlign: "right" }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "방금 전";
  if (mins < 60)  return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7)   return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */
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
  amber,
}: {
  label: string;
  value: number;
  accent?: boolean;
  dim?: boolean;
  amber?: boolean;
}) {
  const valueColor = accent
    ? "#b197fc"
    : amber
      ? "#fbbf24"
      : dim
        ? "rgba(245,240,232,0.4)"
        : "#f5f0e8";
  const borderColor = accent
    ? "rgba(139,92,246,0.40)"
    : amber
      ? "rgba(251,191,36,0.25)"
      : "rgba(245,240,232,0.10)";
  const glowShadow = accent
    ? "0 0 18px rgba(109,40,217,0.2)"
    : amber
      ? "0 0 14px rgba(251,191,36,0.1)"
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

function ErrorStat({ label, accent, dim }: { label: string; accent?: boolean; dim?: boolean }) {
  const borderColor = accent ? "rgba(139,92,246,0.25)" : "rgba(245,240,232,0.07)";
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        background: "rgba(2,6,4,0.88)",
        padding: "13px 14px",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <p style={{ color: "rgba(245,240,232,0.2)", fontSize: 28, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 5 }}>
        —
      </p>
      <p style={{ color: "rgba(245,240,232,0.25)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
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
        background: active ? "rgba(134,239,172,0.1)" : "rgba(245,240,232,0.05)",
        border: active ? "1px solid rgba(134,239,172,0.22)" : "1px solid rgba(245,240,232,0.09)",
        color: active ? "#86efac" : "rgba(245,240,232,0.28)",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const part = action.split(".")[1] ?? action;
  const isCreate = part === "create";
  const isDelete = part === "delete";
  const color = isCreate
    ? "#86efac"
    : isDelete
      ? "#fca5a5"
      : "#c4b5fd";
  const bg = isCreate
    ? "rgba(134,239,172,0.08)"
    : isDelete
      ? "rgba(252,165,165,0.08)"
      : "rgba(196,181,253,0.08)";
  const border = isCreate
    ? "rgba(134,239,172,0.2)"
    : isDelete
      ? "rgba(252,165,165,0.2)"
      : "rgba(196,181,253,0.18)";

  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "1px 6px",
        borderRadius: 3,
        background: bg,
        border: `1px solid ${border}`,
        color,
        flexShrink: 0,
      }}
    >
      {action}
    </span>
  );
}

function SectionError() {
  return (
    <p style={{ color: "rgba(252,165,165,0.5)", fontSize: 11, textAlign: "center", padding: "16px 12px" }}>
      데이터를 불러올 수 없습니다.
    </p>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "rgba(245,240,232,0.3)", fontSize: 13, textAlign: "center", padding: "20px 16px" }}>
      {children}
    </p>
  );
}
