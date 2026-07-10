"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClubDetail, MemberSummary, AuditEntry, MatchStats } from "./page";

/* ── design tokens ─────────────────────────────────────── */
const C = {
  bg:        "rgba(2,6,4,0.92)",
  border:    "rgba(245,240,232,0.10)",
  cream:     "#f5f0e8",
  muted:     "rgba(245,240,232,0.38)",
  dim:       "rgba(245,240,232,0.22)",
  purple:    "#c4b5fd",
  purpleBg:  "rgba(109,40,217,0.22)",
  purpleBdr: "rgba(139,92,246,0.45)",
  green:     "#86efac",
  greenBg:   "rgba(134,239,172,0.10)",
  greenBdr:  "rgba(134,239,172,0.22)",
  red:       "#fca5a5",
  redBg:     "rgba(252,165,165,0.10)",
  redBdr:    "rgba(252,165,165,0.22)",
  amber:     "#fcd34d",
  amberBg:   "rgba(252,211,77,0.10)",
  amberBdr:  "rgba(252,211,77,0.22)",
};

const OPERATOR_ROLES = new Set(["master", "admin", "manager"]);
const ROLE_ORDER: Record<string, number> = { master: 0, admin: 1, manager: 2, scorer: 3, member: 4 };

interface Props {
  club: ClubDetail;
  members: MemberSummary[] | null;
  audit: AuditEntry[] | null;
  matchStats: MatchStats | null;
  isOwner: boolean;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function fmtRelative(iso: string): string {
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

/* ════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════ */
export function ClubDetailPageClient({ club: initial, members, audit, matchStats, isOwner }: Props) {
  const router = useRouter();
  const [club, setClub] = useState<ClubDetail>(initial);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  /* edit form */
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState(club.name);
  const [eSlug, setESlug] = useState(club.slug);
  const [eDesc, setEDesc] = useState(club.description ?? "");

  /* status confirm */
  const [statusConfirm, setStatusConfirm] = useState(false);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── patch club ── */
  async function patchClub(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const errMap: Record<string, string> = {
          slug_invalid: "slug는 소문자·숫자·하이픈만 허용됩니다.",
          slug_reserved: "예약된 slug입니다.",
          slug_taken: "이미 사용 중인 slug입니다.",
          status_invalid: "유효하지 않은 상태값입니다.",
          nothing_to_update: "변경된 내용이 없습니다.",
          forbidden: "owner만 수정할 수 있습니다.",
        };
        showToast(errMap[json.error] ?? `오류: ${json.error}`, false);
        return false;
      }
      setClub(json.club as ClubDetail);
      return true;
    } catch {
      showToast("네트워크 오류가 발생했습니다.", false);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ── edit submit ── */
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await patchClub({
      name: eName.trim(),
      slug: slugify(eSlug),
      description: eDesc.trim() || null,
    });
    if (ok) {
      showToast("클럽 정보가 수정되었습니다.", true);
      setEditing(false);
    }
  }

  /* ── status toggle ── */
  async function handleStatusChange() {
    const newStatus = club.status === "active" ? "inactive" : "active";
    const ok = await patchClub({ status: newStatus });
    if (ok) {
      showToast(
        newStatus === "active" ? "클럽을 활성화했습니다." : "클럽을 비활성화했습니다.",
        true,
      );
      setStatusConfirm(false);
      router.refresh();
    }
  }

  /* derived stats */
  const totalMembers   = members?.length ?? 0;
  const activeMembers  = members?.filter(m => m.is_active).length ?? 0;
  const operators      = members?.filter(m => OPERATOR_ROLES.has(m.permission_role)) ?? [];
  const since30dISO    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newMembers30d  = members?.filter(m => m.created_at >= since30dISO).length ?? 0;

  const operatorsSorted = [...operators].sort((a, b) => {
    const ra = ROLE_ORDER[a.permission_role] ?? 99;
    const rb = ROLE_ORDER[b.permission_role] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ko");
  });

  return (
    <>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 99999, pointerEvents: "none",
          background: toast.ok ? "rgba(6,20,12,0.97)" : "rgba(20,6,6,0.97)",
          border: `1px solid ${toast.ok ? C.greenBdr : C.redBdr}`,
          color: toast.ok ? C.green : C.red,
          borderRadius: 10, padding: "10px 20px",
          fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Status Confirm Modal ── */}
      {statusConfirm && (
        <Overlay onClose={() => setStatusConfirm(false)}>
          <div style={{ maxWidth: 340, width: "100%" }}>
            <p style={{ color: C.cream, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
              {club.status === "active" ? "클럽 비활성화" : "클럽 활성화"}
            </p>
            <p style={{ color: C.muted, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
              {club.status === "active"
                ? `"${club.name}"을 비활성화합니다. 클럽 페이지 접근이 제한될 수 있습니다.`
                : `"${club.name}"을 활성화합니다.`}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="cd-btn-ghost" onClick={() => setStatusConfirm(false)} disabled={busy}>
                취소
              </button>
              <button
                className="cd-btn-primary"
                onClick={handleStatusChange}
                disabled={busy}
                style={{
                  background: club.status === "active" ? C.redBg : C.greenBg,
                  borderColor: club.status === "active" ? C.redBdr : C.greenBdr,
                  color: club.status === "active" ? C.red : C.green,
                }}
              >
                {busy ? "처리 중…" : club.status === "active" ? "비활성화" : "활성화"}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Main layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, alignItems: "start" }}
        className="lg:grid-cols-[1fr_260px]">

        {/* ════ Left ════ */}
        <div>

          {/* ── Header ── */}
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/center-court/clubs"
              style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 14 }}
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Club Registry
            </Link>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h1 style={{ color: C.cream, fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", letterSpacing: "0.03em", lineHeight: 1.2 }}>
                    {club.name}
                  </h1>
                  <StatusPill status={club.status} />
                </div>
                <p style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>
                  /c/{club.slug}
                </p>
                <div style={{ display: "flex", gap: 16 }}>
                  <MetaItem label="생성일" value={fmtDate(club.created_at)} />
                </div>
              </div>

              {/* Actions */}
              {isOwner && (
                <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                  <button
                    className="cd-btn-ghost"
                    onClick={() => {
                      setEName(club.name);
                      setESlug(club.slug);
                      setEDesc(club.description ?? "");
                      setEditing(true);
                    }}
                    disabled={busy}
                  >
                    Edit Info
                  </button>
                  <button
                    className="cd-btn-ghost"
                    onClick={() => setStatusConfirm(true)}
                    disabled={busy}
                    style={{
                      color: club.status === "active" ? "rgba(252,165,165,0.7)" : "rgba(134,239,172,0.7)",
                      borderColor: club.status === "active" ? "rgba(252,165,165,0.22)" : "rgba(134,239,172,0.22)",
                    }}
                  >
                    {club.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Edit Form ── */}
          {editing && (
            <CourtPanel style={{ marginBottom: 20 }}>
              <form onSubmit={handleEditSubmit} style={{ padding: "16px 18px" }}>
                <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  Edit Club Info
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Club Name</span>
                    <input className="cd-input" value={eName} onChange={e => setEName(e.target.value)} required disabled={busy} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Slug</span>
                    <input className="cd-input" value={eSlug}
                      onChange={e => { setESlug(slugify(e.target.value)); }}
                      placeholder="lowercase-with-hyphens" required disabled={busy} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Description</span>
                    <textarea className="cd-input" rows={2} value={eDesc} onChange={e => setEDesc(e.target.value)} disabled={busy} />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                  <button type="button" className="cd-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
                  <button type="submit" className="cd-btn-primary" disabled={busy}>
                    {busy ? "저장 중…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </CourtPanel>
          )}

          {/* ── Overview Stats ── */}
          <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 9, fontFamily: "Georgia, serif" }}>
            Overview
          </p>
          {members === null ? (
            <SectionError />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              <StatPanel label="Total Members"    value={totalMembers} />
              <StatPanel label="Active Members"   value={activeMembers} accent />
              <StatPanel label="Operators"        value={operatorsSorted.length} amber />
              <StatPanel label="Total Matches"    value={matchStats?.total ?? null} />
              <StatPanel label="Matches (30d)"    value={matchStats?.recent30d ?? null} />
              <StatPanel label="New Members (30d)" value={newMembers30d} />
            </div>
          )}

          {/* ── Club Information ── */}
          <section style={{ marginBottom: 20 }}>
            <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 9, fontFamily: "Georgia, serif" }}>
              Club Information
            </p>
            <CourtPanel>
              <div style={{ padding: "14px 18px" }}>
                {[
                  { label: "Name",        value: club.name },
                  { label: "Slug",        value: `/c/${club.slug}` },
                  { label: "Status",      value: club.status },
                  { label: "Description", value: club.description ?? "—" },
                  { label: "ID",          value: club.id },
                  { label: "Created",     value: fmtDate(club.created_at) },
                ].map((row, idx, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex", gap: 16, paddingBottom: 10, marginBottom: 10,
                      borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, width: 80 }}>
                      {row.label}
                    </span>
                    <span style={{ color: C.muted, fontSize: 11, lineHeight: 1.5, wordBreak: "break-all" }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </CourtPanel>
          </section>

          {/* ── Club Operators ── */}
          <section style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "Georgia, serif" }}>
                Operators
              </p>
              <Link
                href={`/center-court/clubs`}
                style={{ color: "rgba(196,181,253,0.45)", fontSize: 9, letterSpacing: "0.12em", textDecoration: "none", fontWeight: 700, textTransform: "uppercase" }}
              >
                Manage →
              </Link>
            </div>

            {members === null ? (
              <SectionError />
            ) : operatorsSorted.length === 0 ? (
              <CourtPanel>
                <p style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: "18px 16px" }}>운영진이 없습니다.</p>
              </CourtPanel>
            ) : (
              <CourtPanel>
                {operatorsSorted.map((op, idx) => (
                  <div
                    key={op.id}
                    style={{
                      padding: "10px 16px",
                      borderBottom: idx < operatorsSorted.length - 1 ? `1px solid ${C.border}` : "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    }}
                  >
                    <div>
                      <span style={{ color: C.cream, fontSize: 12, fontWeight: 600 }}>{op.name}</span>
                      <span style={{ color: C.dim, fontSize: 9, marginLeft: 8, letterSpacing: "0.06em" }}>{op.is_active ? "" : "비활성"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <RolePill role={op.permission_role} />
                      {!op.is_active && (
                        <span style={{ fontSize: 8, color: "rgba(252,165,165,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </CourtPanel>
            )}
          </section>
        </div>

        {/* ════ Right sidebar ════ */}
        <aside>
          <div className="hidden lg:block">
            {/* ── Recent Activity ── */}
            <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 9, fontFamily: "Georgia, serif" }}>
              Recent Activity
            </p>
            {audit === null ? (
              <SectionError />
            ) : audit.length === 0 ? (
              <div style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, padding: "14px 16px" }}>
                <p style={{ color: C.dim, fontSize: 11, textAlign: "center" }}>감사 로그가 없습니다.</p>
              </div>
            ) : (
              <div style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
                {audit.map((log, idx) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: idx < audit.length - 1 ? `1px solid rgba(245,240,232,0.05)` : "none",
                      background: idx % 2 === 0 ? "rgba(2,6,4,0.92)" : "rgba(4,10,7,0.88)",
                    }}
                  >
                    <ActionBadge action={log.action} />
                    <p style={{ color: "rgba(245,240,232,0.65)", fontSize: 10, fontWeight: 500, marginTop: 3, marginBottom: 2 }}>
                      {log.target_label ?? "—"}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ color: C.dim, fontSize: 9 }}>{log.platform_admin_username}</span>
                      <span style={{ color: "rgba(245,240,232,0.20)", fontSize: 9 }}>{fmtRelative(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Member count breakdown (mobile hidden) ── */}
            {members !== null && (
              <div style={{ marginTop: 16, borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, padding: "13px 16px", boxShadow: "0 4px 18px rgba(0,0,0,0.5)" }}>
                <p style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
                  Member Breakdown
                </p>
                {[
                  { label: "Master",  count: members.filter(m => m.permission_role === "master").length,  color: C.purple },
                  { label: "Admin",   count: members.filter(m => m.permission_role === "admin").length,   color: C.amber },
                  { label: "Manager", count: members.filter(m => m.permission_role === "manager").length, color: "rgba(134,239,172,0.7)" },
                  { label: "Member",  count: members.filter(m => m.permission_role === "member").length,  color: C.muted },
                  { label: "Scorer",  count: members.filter(m => m.permission_role === "scorer").length,  color: C.dim },
                  { label: "Inactive", count: members.filter(m => !m.is_active).length,                  color: "rgba(252,165,165,0.5)" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingBottom: 5, marginBottom: 5, borderBottom: `1px solid rgba(245,240,232,0.04)` }}>
                    <span style={{ color: C.dim, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.label}</span>
                    <span style={{ color: row.color, fontSize: 11, fontWeight: 700, fontFamily: "Georgia, serif" }}>{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile: recent activity below operators */}
          <div className="lg:hidden" style={{ marginTop: 20 }}>
            <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 9, fontFamily: "Georgia, serif" }}>
              Recent Activity
            </p>
            {audit === null ? (
              <SectionError />
            ) : audit.length === 0 ? (
              <CourtPanel>
                <p style={{ color: C.dim, fontSize: 11, textAlign: "center", padding: "14px 16px" }}>감사 로그가 없습니다.</p>
              </CourtPanel>
            ) : (
              <CourtPanel>
                {audit.map((log, idx) => (
                  <div key={log.id} style={{ padding: "10px 14px", borderBottom: idx < audit.length - 1 ? `1px solid rgba(245,240,232,0.05)` : "none" }}>
                    <ActionBadge action={log.action} />
                    <p style={{ color: "rgba(245,240,232,0.65)", fontSize: 10, marginTop: 3, marginBottom: 2 }}>{log.target_label ?? "—"}</p>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: C.dim, fontSize: 9 }}>{log.platform_admin_username}</span>
                      <span style={{ color: "rgba(245,240,232,0.20)", fontSize: 9 }}>{fmtRelative(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </CourtPanel>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        .cd-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 7px;
          color: #f5f0e8;
          font-size: 12px;
          padding: 7px 10px;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          font-family: inherit;
          resize: vertical;
        }
        .cd-input:focus { border-color: rgba(139,92,246,0.55); }
        .cd-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .cd-btn-primary {
          background: rgba(109,40,217,0.22);
          border: 1px solid rgba(139,92,246,0.45);
          border-radius: 7px;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 6px 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .cd-btn-primary:hover:not(:disabled) { background: rgba(109,40,217,0.35); }
        .cd-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .cd-btn-ghost {
          background: transparent;
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 7px;
          color: rgba(245,240,232,0.55);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 6px 14px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .cd-btn-ghost:hover:not(:disabled) { border-color: rgba(245,240,232,0.28); }
        .cd-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function CourtPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 13,
      border: "1px solid rgba(245,240,232,0.12)",
      background: "rgba(2,6,4,0.90)",
      overflow: "hidden",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatPanel({ label, value, accent, amber }: { label: string; value: number | null; accent?: boolean; amber?: boolean }) {
  const valueColor = accent ? "#b197fc" : amber ? "#fcd34d" : "#f5f0e8";
  const borderColor = accent ? "rgba(139,92,246,0.35)" : amber ? "rgba(252,211,77,0.22)" : "rgba(245,240,232,0.10)";

  return (
    <div style={{
      borderRadius: 11,
      border: `1px solid ${borderColor}`,
      background: "rgba(2,6,4,0.88)",
      padding: "11px 13px",
    }}>
      <p style={{ color: valueColor, fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4, fontFamily: "Georgia, serif" }}>
        {value === null ? "—" : value}
      </p>
      <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 4,
      background: active ? "rgba(134,239,172,0.1)" : "rgba(245,240,232,0.05)",
      border: `1px solid ${active ? "rgba(134,239,172,0.22)" : "rgba(245,240,232,0.09)"}`,
      color: active ? "#86efac" : "rgba(245,240,232,0.28)",
      flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  const colors: Record<string, { color: string; border: string; bg: string }> = {
    master:  { color: "#c4b5fd", border: "rgba(139,92,246,0.35)", bg: "rgba(109,40,217,0.15)" },
    admin:   { color: "#fcd34d", border: "rgba(252,211,77,0.22)", bg: "rgba(252,211,77,0.08)" },
    manager: { color: "#86efac", border: "rgba(134,239,172,0.22)", bg: "rgba(134,239,172,0.08)" },
  };
  const s = colors[role] ?? { color: "rgba(245,240,232,0.38)", border: "rgba(245,240,232,0.09)", bg: "rgba(245,240,232,0.04)" };
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "1px 7px", borderRadius: 3,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>
      {role}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const part = action.split(".")[1] ?? action;
  const isCreate = part === "create";
  const isDelete = part === "delete";
  const color  = isCreate ? "#86efac" : isDelete ? "#fca5a5" : "#c4b5fd";
  const bg     = isCreate ? "rgba(134,239,172,0.08)" : isDelete ? "rgba(252,165,165,0.08)" : "rgba(196,181,253,0.08)";
  const border = isCreate ? "rgba(134,239,172,0.2)" : isDelete ? "rgba(252,165,165,0.2)" : "rgba(196,181,253,0.18)";
  return (
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 3, background: bg, border: `1px solid ${border}`, color }}>
      {action}
    </span>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "rgba(245,240,232,0.22)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}:{" "}
      </span>
      <span style={{ color: "rgba(245,240,232,0.42)", fontSize: 9 }}>{value}</span>
    </div>
  );
}

function SectionError() {
  return (
    <p style={{ color: "rgba(252,165,165,0.45)", fontSize: 11, padding: "14px 0" }}>
      데이터를 불러올 수 없습니다.
    </p>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: "rgba(4,10,6,0.98)", border: "1px solid rgba(245,240,232,0.12)", borderRadius: 14, padding: "22px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.85)", width: "100%", maxWidth: 380 }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
