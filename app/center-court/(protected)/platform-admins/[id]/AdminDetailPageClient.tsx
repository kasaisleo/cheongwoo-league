"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminDetail, AuditLogEntry, AuditStats } from "./page";

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

interface Props {
  admin: AdminDetail;
  recentAudit: AuditLogEntry[] | null;
  auditStats: AuditStats | null;
  activeOwnerCount: number | null;
  currentAdminId: string;
  currentAdminRole: string;
}

const ERR_MAP: Record<string, string> = {
  cannot_deactivate_self:          "본인 계정은 비활성화할 수 없습니다.",
  cannot_demote_self:              "본인의 role을 낮출 수 없습니다.",
  last_owner_cannot_be_deactivated:"마지막 활성 owner는 비활성화할 수 없습니다.",
  last_owner_cannot_be_demoted:    "마지막 활성 owner의 role을 낮출 수 없습니다.",
  password_too_short:              "비밀번호는 최소 8자 이상이어야 합니다.",
  invalid_role:                    "유효하지 않은 role입니다.",
  invalid_status:                  "유효하지 않은 상태값입니다.",
  forbidden:                       "owner만 수정할 수 있습니다.",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "방금 전";
  if (mins  < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days  < 7)  return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/* ── confirm modal kinds ─────────────────────────────────── */
type ModalKind =
  | { kind: "status" }
  | { kind: "password" };

/* ════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════ */
export function AdminDetailPageClient({
  admin: initial,
  recentAudit,
  auditStats,
  activeOwnerCount,
  currentAdminId,
  currentAdminRole: _currentAdminRole,
}: Props) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDetail>(initial);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy]     = useState(false);
  const [modal, setModal]   = useState<ModalKind | null>(null);

  /* edit display_name */
  const [editingName, setEditingName] = useState(false);
  const [eName, setEName] = useState(admin.display_name ?? "");

  /* password reset */
  const [newPassword, setNewPassword] = useState("");


  const isSelf       = admin.id === currentAdminId;
  const isLastOwner  = admin.role === "owner" && (activeOwnerCount ?? 0) <= 1;

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── patch helper ── */
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(ERR_MAP[json.error as string] ?? `오류: ${json.error}`, false);
        return false;
      }
      setAdmin(json.admin as AdminDetail);
      return true;
    } catch {
      showToast("네트워크 오류가 발생했습니다.", false);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ── display_name submit ── */
  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await patch({ display_name: eName.trim() });
    if (ok) {
      showToast("이름이 수정되었습니다.", true);
      setEditingName(false);
    }
  }

  /* ── role change ── */
  function requestRoleChange(newRole: string) {
    if (newRole === admin.role) return;
    patch({ role: newRole }).then(ok => {
      if (ok) {
        showToast(`Role이 ${newRole}로 변경되었습니다.`, true);
        router.refresh();
      }
    });
  }

  /* ── status toggle ── */
  async function handleStatusChange() {
    const newStatus = admin.status === "active" ? "inactive" : "active";
    const ok = await patch({ status: newStatus });
    if (ok) {
      showToast(
        newStatus === "active" ? "계정을 활성화했습니다." : "계정을 비활성화했습니다.",
        true,
      );
      setModal(null);
      router.refresh();
    }
  }

  /* ── password reset submit ── */
  async function handlePasswordReset() {
    const ok = await patch({ password: newPassword });
    if (ok) {
      showToast("비밀번호가 초기화되었습니다.", true);
      setNewPassword("");
      setModal(null);
    }
  }

  /* ── status change disabled conditions ── */
  const canToggleStatus = !isSelf && !isLastOwner;
  const statusBlockReason = isSelf
    ? "본인 계정은 비활성화할 수 없습니다."
    : isLastOwner
      ? "마지막 owner는 비활성화할 수 없습니다."
      : null;

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

      {/* ── Confirm Modal ── */}
      {modal && (
        <Overlay onClose={() => { setModal(null); setNewPassword(""); }}>
          {modal.kind === "status" && (
            <ConfirmBody
              title={admin.status === "active" ? "계정 비활성화" : "계정 활성화"}
              message={
                admin.status === "active"
                  ? `"${admin.username}" 계정을 비활성화합니다. 기존 세션이 즉시 무효화됩니다.`
                  : `"${admin.username}" 계정을 활성화합니다.`
              }
              confirmLabel={admin.status === "active" ? "비활성화" : "활성화"}
              confirmColor={admin.status === "active" ? C.red : C.green}
              confirmBorder={admin.status === "active" ? C.redBdr : C.greenBdr}
              busy={busy}
              onCancel={() => setModal(null)}
              onConfirm={handleStatusChange}
            />
          )}

          {modal.kind === "password" && (
            <div>
              <p style={{ color: C.cream, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                비밀번호 초기화
              </p>
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 14, lineHeight: 1.6 }}>
                {admin.username}의 비밀번호를 새로 설정합니다.
              </p>
              <input
                className="adm-input"
                type="password"
                placeholder="새 비밀번호 (최소 8자)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                disabled={busy}
                autoComplete="new-password"
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                <button className="adm-btn-ghost" onClick={() => { setModal(null); setNewPassword(""); }} disabled={busy}>
                  취소
                </button>
                <button
                  className="adm-btn-primary"
                  onClick={handlePasswordReset}
                  disabled={busy || newPassword.length < 8}
                >
                  {busy ? "처리 중…" : "초기화"}
                </button>
              </div>
            </div>
          )}

        </Overlay>
      )}

      {/* ── Main Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, alignItems: "start" }}
        className="lg:grid-cols-[1fr_280px]">

        {/* ════ Left ════ */}
        <div>
          {/* ── Header ── */}
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/center-court/platform-admins"
              style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 14 }}
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Platform Admins
            </Link>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <h1 style={{ color: C.cream, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
                    {admin.display_name ?? admin.username}
                  </h1>
                  <RoleBadge role={admin.role} />
                  <StatusBadge status={admin.status} />
                  {isSelf && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.amber, border: `1px solid ${C.amberBdr}`, borderRadius: 3, padding: "1px 6px" }}>
                      YOU
                    </span>
                  )}
                </div>
                <p style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 5 }}>
                  @{admin.username}
                </p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <MetaItem label="생성일" value={fmtDate(admin.created_at)} />
                  <MetaItem label="수정일" value={fmtDate(admin.updated_at)} />
                  {admin.last_login_at && (
                    <MetaItem label="최근 로그인" value={fmtRelative(admin.last_login_at)} />
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flexShrink: 0 }}>
                <button className="adm-btn-ghost" onClick={() => { setEName(admin.display_name ?? ""); setEditingName(true); }} disabled={busy}>
                  Edit Name
                </button>
                <button className="adm-btn-ghost" onClick={() => setModal({ kind: "password" })} disabled={busy}>
                  Reset PW
                </button>
                {canToggleStatus ? (
                  <button
                    className="adm-btn-ghost"
                    onClick={() => setModal({ kind: "status" })}
                    disabled={busy}
                    style={{
                      color: admin.status === "active" ? "rgba(252,165,165,0.7)" : "rgba(134,239,172,0.7)",
                      borderColor: admin.status === "active" ? "rgba(252,165,165,0.22)" : "rgba(134,239,172,0.22)",
                    }}
                  >
                    {admin.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                ) : (
                  statusBlockReason && (
                    <span style={{ fontSize: 9, color: "rgba(245,240,232,0.25)", alignSelf: "center", maxWidth: 140, lineHeight: 1.4 }}>
                      {statusBlockReason}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ── Edit Name Form ── */}
          {editingName && (
            <CourtPanel style={{ marginBottom: 20 }}>
              <form onSubmit={handleNameSubmit} style={{ padding: "16px 18px" }}>
                <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
                  Edit Display Name
                </p>
                <input
                  className="adm-input"
                  value={eName}
                  onChange={e => setEName(e.target.value)}
                  placeholder="표시 이름"
                  disabled={busy}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                  <button type="button" className="adm-btn-ghost" onClick={() => setEditingName(false)} disabled={busy}>Cancel</button>
                  <button type="submit" className="adm-btn-primary" disabled={busy}>
                    {busy ? "저장 중…" : "Save"}
                  </button>
                </div>
              </form>
            </CourtPanel>
          )}

          {/* ── Stats ── */}
          <SectionLabel>Activity Overview</SectionLabel>
          {auditStats === null ? (
            <p style={{ color: "rgba(252,165,165,0.45)", fontSize: 11, marginBottom: 20 }}>데이터를 불러올 수 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              <StatPanel label="Total Logs"     value={auditStats.total} />
              <StatPanel label="Last 24h"       value={auditStats.last24h} accent />
              <StatPanel label="Last 30d"       value={auditStats.last30d} />
              <StatPanel label="Admins Created" value={auditStats.adminCreated} amber />
              <StatPanel label="Clubs Touched"  value={auditStats.clubsTouched} />
              <div style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, padding: "11px 13px" }}>
                <p style={{ color: C.muted, fontSize: 9, lineHeight: 1.5 }}>
                  <span style={{ color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 8, display: "block", marginBottom: 4 }}>Last Activity</span>
                  {auditStats.lastActivity ? fmtRelative(auditStats.lastActivity) : "없음"}
                </p>
              </div>
            </div>
          )}

          {/* ── Account Information ── */}
          <section style={{ marginBottom: 20 }}>
            <SectionLabel>Account Information</SectionLabel>
            <CourtPanel>
              <div style={{ padding: "14px 18px" }}>

                {/* Role field with inline change */}
                <div style={{ display: "flex", gap: 16, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                  <span style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, width: 88 }}>Role</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
                    <RoleBadge role={admin.role} />
                    {(isSelf || isLastOwner) ? (
                      <p style={{ color: "rgba(252,211,77,0.55)", fontSize: 9, lineHeight: 1.5, marginLeft: "auto", textAlign: "right", maxWidth: 180 }}>
                        {isSelf
                          ? "본인 계정의 OWNER 권한은 변경할 수 없습니다."
                          : "마지막 활성 OWNER는 권한을 변경하거나 비활성화할 수 없습니다."}
                      </p>
                    ) : (
                      <select
                        className="adm-select"
                        value={admin.role}
                        onChange={e => requestRoleChange(e.target.value)}
                        disabled={busy}
                        style={{ marginLeft: "auto" }}
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                  </div>
                </div>

                {[
                  { label: "Username",    value: admin.username },
                  { label: "Display Name",value: admin.display_name ?? "—" },
                  { label: "Status",      value: admin.status },
                  { label: "ID",          value: admin.id },
                  { label: "Created",     value: fmtDateTime(admin.created_at) },
                  { label: "Updated",     value: fmtDateTime(admin.updated_at) },
                  ...(admin.last_login_at
                    ? [{ label: "Last Login", value: fmtDateTime(admin.last_login_at) }]
                    : []),
                ].map((row, idx, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex", gap: 16, paddingBottom: 10, marginBottom: 10,
                      borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, width: 88 }}>
                      {row.label}
                    </span>
                    <span style={{ color: C.muted, fontSize: 11, wordBreak: "break-all" }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </CourtPanel>
          </section>
        </div>

        {/* ════ Right sidebar ════ */}
        <aside>
          <div className="hidden lg:block">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <SectionLabel>Recent Activity</SectionLabel>
              <Link href="/center-court/audit" style={{ color: "rgba(196,181,253,0.45)", fontSize: 9, letterSpacing: "0.12em", textDecoration: "none", fontWeight: 700, textTransform: "uppercase" }}>
                All Logs →
              </Link>
            </div>
            <AuditList logs={recentAudit} />
          </div>
        </aside>
      </div>

      {/* Mobile: recent activity below */}
      <div className="lg:hidden" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
          <SectionLabel>Recent Activity</SectionLabel>
          <Link href="/center-court/audit" style={{ color: "rgba(196,181,253,0.45)", fontSize: 9, letterSpacing: "0.12em", textDecoration: "none", fontWeight: 700, textTransform: "uppercase" }}>
            All Logs →
          </Link>
        </div>
        <AuditList logs={recentAudit} />
      </div>

      <style>{`
        .adm-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 7px;
          color: #f5f0e8;
          font-size: 12px;
          padding: 8px 10px;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          font-family: inherit;
        }
        .adm-input:focus { border-color: rgba(139,92,246,0.55); }
        .adm-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-select {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 6px;
          color: rgba(245,240,232,0.65);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 4px 8px;
          outline: none;
          cursor: pointer;
          font-family: inherit;
        }
        .adm-select:focus { border-color: rgba(139,92,246,0.55); }
        .adm-select:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-btn-primary {
          background: rgba(109,40,217,0.22);
          border: 1px solid rgba(139,92,246,0.45);
          border-radius: 7px;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 6px 14px;
          cursor: pointer;
        }
        .adm-btn-primary:hover:not(:disabled) { background: rgba(109,40,217,0.35); }
        .adm-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .adm-btn-ghost {
          background: transparent;
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 7px;
          color: rgba(245,240,232,0.55);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 6px 14px;
          cursor: pointer;
        }
        .adm-btn-ghost:hover:not(:disabled) { border-color: rgba(245,240,232,0.28); }
        .adm-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </>
  );
}

/* ── Audit log list ──────────────────────────────────────── */
function AuditList({ logs }: { logs: AuditLogEntry[] | null }) {
  if (logs === null) {
    return <p style={{ color: "rgba(252,165,165,0.45)", fontSize: 11 }}>데이터를 불러올 수 없습니다.</p>;
  }
  if (logs.length === 0) {
    return (
      <div style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, padding: "14px 16px" }}>
        <p style={{ color: C.dim, fontSize: 11, textAlign: "center" }}>활동 기록이 없습니다.</p>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.bg, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
      {logs.map((log, idx) => {
        const meta = log.metadata as Record<string, unknown> | null;
        const changedFields = Array.isArray(meta?.changed_fields)
          ? (meta!.changed_fields as string[]).join(", ")
          : null;

        return (
          <div
            key={log.id}
            style={{
              padding: "10px 14px",
              borderBottom: idx < logs.length - 1 ? "1px solid rgba(245,240,232,0.05)" : "none",
              background: idx % 2 === 0 ? "rgba(2,6,4,0.92)" : "rgba(4,10,7,0.88)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
              <ActionBadge action={log.action} />
              <span style={{ color: "rgba(245,240,232,0.22)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {log.target_type}
              </span>
            </div>
            {log.target_label && (
              <p style={{ color: "rgba(245,240,232,0.65)", fontSize: 10, fontWeight: 500, marginBottom: 2 }}>
                {log.target_label}
              </p>
            )}
            {changedFields && (
              <p style={{ color: C.dim, fontSize: 9, marginBottom: 2 }}>변경: {changedFields}</p>
            )}
            <span style={{ color: "rgba(245,240,232,0.20)", fontSize: 9 }}>{fmtRelative(log.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 9, fontFamily: "Georgia, serif" }}>
      {children}
    </p>
  );
}

function CourtPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 13, border: "1px solid rgba(245,240,232,0.12)", background: "rgba(2,6,4,0.90)", overflow: "hidden", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", boxShadow: "0 4px 24px rgba(0,0,0,0.55)", ...style }}>
      {children}
    </div>
  );
}

function StatPanel({ label, value, accent, amber }: { label: string; value: number; accent?: boolean; amber?: boolean }) {
  const valueColor = accent ? "#b197fc" : amber ? "#fcd34d" : "#f5f0e8";
  const borderColor = accent ? "rgba(139,92,246,0.35)" : amber ? "rgba(252,211,77,0.22)" : "rgba(245,240,232,0.10)";
  return (
    <div style={{ borderRadius: 11, border: `1px solid ${borderColor}`, background: C.bg, padding: "11px 13px" }}>
      <p style={{ color: valueColor, fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4, fontFamily: "Georgia, serif" }}>
        {value}
      </p>
      <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === "owner";
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 3,
      background: isOwner ? "rgba(109,40,217,0.18)" : "rgba(252,211,77,0.08)",
      border: `1px solid ${isOwner ? "rgba(139,92,246,0.35)" : "rgba(252,211,77,0.22)"}`,
      color: isOwner ? "#c4b5fd" : "#fcd34d",
    }}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 3,
      background: active ? "rgba(134,239,172,0.10)" : "rgba(245,240,232,0.05)",
      border: `1px solid ${active ? "rgba(134,239,172,0.22)" : "rgba(245,240,232,0.09)"}`,
      color: active ? "#86efac" : "rgba(245,240,232,0.28)",
    }}>
      {status}
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

function ConfirmBody({
  title, message, confirmLabel, confirmColor, confirmBorder, busy, onCancel, onConfirm,
}: {
  title: string; message: string;
  confirmLabel: string; confirmColor: string; confirmBorder: string;
  busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div>
      <p style={{ color: C.cream, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</p>
      <p style={{ color: C.muted, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="adm-btn-ghost" onClick={onCancel} disabled={busy}>취소</button>
        <button
          className="adm-btn-primary"
          onClick={onConfirm}
          disabled={busy}
          style={{ background: `${confirmColor}18`, borderColor: confirmBorder, color: confirmColor }}
        >
          {busy ? "처리 중…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
