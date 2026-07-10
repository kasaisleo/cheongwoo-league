"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface Admin {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

interface Props {
  initialAdmins: Admin[];
  currentAdminId: string;
}

/* ─────────────────────────────────────────────────────────────
   Shared CSS — rendered once at component root
───────────────────────────────────────────────────────────── */
function CcAdminStyles() {
  return (
    <style>{`
      /* input focus ring */
      .cc-admin-input {
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .cc-admin-input:focus {
        outline: none;
        border-color: rgba(139,92,246,0.6) !important;
        box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
      }
      .cc-admin-input:disabled { opacity: 0.45; cursor: not-allowed; }
      .cc-admin-select:focus {
        outline: none;
        border-color: rgba(139,92,246,0.6) !important;
        box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
      }

      /* create-form responsive grid */
      .cc-form-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 560px) {
        .cc-form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px 24px;
        }
      }

      /* button row */
      .cc-btn-row {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      @media (min-width: 480px) {
        .cc-btn-row { flex-direction: row; gap: 10px; }
      }
      .cc-btn-primary-create { width: 100%; }
      .cc-btn-cancel { width: 100%; }
      @media (min-width: 480px) {
        .cc-btn-primary-create { width: auto; }
        .cc-btn-cancel { width: auto; }
      }

      /* form card inner padding */
      .cc-create-form-body {
        padding: 20px 20px 24px;
      }
      @media (min-width: 560px) {
        .cc-create-form-body {
          padding: 28px 28px 32px;
        }
      }

      /* admin roster row hover */
      .cc-roster-row:hover { background: rgba(245,240,232,0.025); }

      /* badge row wraps on mobile */
      .cc-badge-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 3px;
      }
    `}</style>
  );
}

export default function PlatformAdminsPageClient({
  initialAdmins,
  currentAdminId,
}: Props) {
  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [patchBusy, setPatchBusy] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    display_name: "",
    password: "",
    role: "admin" as "owner" | "admin",
  });

  const refreshAdmins = useCallback(async () => {
    const res = await fetch("/api/platform/admins");
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins ?? []);
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreateBusy(true);
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateSuccess(`Account "${data.admin.username}" created successfully.`);
        setForm({ username: "", display_name: "", password: "", role: "admin" });
        setCreateOpen(false);
        await refreshAdmins();
      } else {
        const msg: Record<string, string> = {
          username_required: "Username is required.",
          password_too_short: "Password must be at least 8 characters.",
          invalid_role: "Invalid role.",
          username_taken: "Username is already taken.",
        };
        setCreateError(msg[data.error] ?? "Failed to create account.");
      }
    } finally {
      setCreateBusy(false);
    }
  }

  async function handlePatch(id: string, updates: Record<string, unknown>) {
    setPatchBusy(id);
    setPatchError(null);
    try {
      const res = await fetch(`/api/platform/admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshAdmins();
      } else {
        const msg: Record<string, string> = {
          cannot_deactivate_self: "You cannot deactivate your own account.",
          last_owner_cannot_be_deactivated: "The last owner account cannot be deactivated.",
          last_owner_cannot_be_demoted: "The last owner account cannot be demoted to admin.",
        };
        setPatchError(msg[data.error] ?? "Failed to update account.");
      }
    } finally {
      setPatchBusy(null);
    }
  }

  return (
    <div>
      <CcAdminStyles />

      {/* 페이지 타이틀 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={labelStyle}>Platform Admins</p>
          <h1
            style={{
              color: "#f5f0e8",
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Admin Roster
          </h1>
          <p style={{ color: "rgba(245,240,232,0.32)", fontSize: 12, marginTop: 5 }}>
            Manage operator accounts and access roles.
          </p>
        </div>

        {/* 상단 Create / Close 토글 버튼 */}
        <button
          onClick={() => {
            if (createOpen) {
              setCreateOpen(false);
            } else {
              setCreateOpen(true);
              setCreateError(null);
              setCreateSuccess(null);
            }
          }}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            background: createOpen
              ? "transparent"
              : "rgba(109,40,217,0.7)",
            border: createOpen
              ? "1px solid rgba(245,240,232,0.2)"
              : "none",
            color: createOpen ? "rgba(245,240,232,0.55)" : "#f5f0e8",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          {createOpen ? "✕ Close" : "+ Create Admin"}
        </button>
      </div>

      {/* 성공 메시지 */}
      {createSuccess && (
        <div style={successBoxStyle}>{createSuccess}</div>
      )}
      {/* 패치 에러 */}
      {patchError && (
        <div style={errorBoxStyle}>{patchError}</div>
      )}

      {/* ── CREATE ADMIN 폼 카드 ─────────────────────────────── */}
      {createOpen && (
        <div style={purpleCardStyle} className="mb-5">
          <div className="cc-create-form-body">
            {/* CREATE ADMIN 섹션 라벨 */}
            <p
              style={{
                color: "rgba(196,181,253,0.5)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontFamily: "Georgia, serif",
                marginBottom: 20,
              }}
            >
              Create Admin
            </p>

            <form onSubmit={handleCreate} noValidate>
              {/* Row 1: Username / Display Name */}
              <div className="cc-form-grid" style={{ marginBottom: 0 }}>
                <div>
                  <FieldLabel>Username *</FieldLabel>
                  <CcInput
                    value={form.username}
                    onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                    placeholder="username"
                    disabled={createBusy}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <FieldLabel>Display Name</FieldLabel>
                  <CcInput
                    value={form.display_name}
                    onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                    placeholder="Display name"
                    disabled={createBusy}
                    autoComplete="off"
                  />
                </div>

                {/* Row 2: Password / Role */}
                <div>
                  <FieldLabel>Password * (min. 8 chars)</FieldLabel>
                  <CcInput
                    type="password"
                    value={form.password}
                    onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                    placeholder="••••••••"
                    disabled={createBusy}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <FieldLabel>Role</FieldLabel>
                  <CcSelect
                    value={form.role}
                    onChange={(v) => setForm((f) => ({ ...f, role: v as "owner" | "admin" }))}
                    disabled={createBusy}
                    options={[
                      { value: "admin", label: "ADMIN" },
                      { value: "owner", label: "OWNER" },
                    ]}
                  />
                </div>
              </div>

              {/* 에러 */}
              {createError && (
                <div style={{ ...errorBoxStyle, marginTop: 16, marginBottom: 0 }}>
                  {createError}
                </div>
              )}

              {/* 버튼 row */}
              <div className="cc-btn-row" style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="cc-btn-primary-create"
                  style={{
                    padding: "11px 20px",
                    borderRadius: 9,
                    background: createBusy
                      ? "rgba(109,40,217,0.3)"
                      : "rgba(109,40,217,0.75)",
                    border: "none",
                    color: "#f5f0e8",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: createBusy ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {createBusy ? "Creating…" : "Create Account"}
                </button>
                <button
                  type="button"
                  className="cc-btn-cancel"
                  onClick={() => setCreateOpen(false)}
                  style={{
                    padding: "11px 20px",
                    borderRadius: 9,
                    background: "transparent",
                    border: "1px solid rgba(245,240,232,0.15)",
                    color: "rgba(245,240,232,0.45)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADMIN ROSTER 카드 ─────────────────────────────────── */}
      <div style={defaultCardStyle}>
        <div
          style={{
            padding: "10px 16px 9px",
            borderBottom: "1px solid rgba(245,240,232,0.06)",
          }}
        >
          <p
            style={{
              color: "rgba(245,240,232,0.22)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Admin Roster
          </p>
        </div>

        {admins.length === 0 ? (
          <p
            style={{
              color: "rgba(245,240,232,0.35)",
              fontSize: 13,
              textAlign: "center",
              padding: "28px 16px",
            }}
          >
            No admin accounts found.
          </p>
        ) : (
          admins.map((admin, idx) => (
            <AdminRow
              key={admin.id}
              admin={admin}
              isSelf={admin.id === currentAdminId}
              isLast={idx === admins.length - 1}
              onPatch={(updates) => handlePatch(admin.id, updates)}
              patchBusy={patchBusy === admin.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AdminRow
───────────────────────────────────────────────────────────── */
function AdminRow({
  admin,
  isSelf,
  isLast,
  onPatch,
  patchBusy,
}: {
  admin: {
    id: string;
    username: string;
    display_name: string | null;
    role: string;
    status: string;
    last_login_at: string | null;
    created_at: string;
  };
  isSelf: boolean;
  isLast: boolean;
  onPatch: (u: Record<string, unknown>) => void;
  patchBusy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState(admin.display_name ?? "");

  const isActive = admin.status === "active";

  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(245,240,232,0.07)",
      }}
    >
      {/* 메인 행 */}
      <div
        className="cc-roster-row"
        style={{
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* username + badges — flex-wrap on mobile */}
          <div className="cc-badge-row">
            <span
              style={{
                color: "#f5f0e8",
                fontSize: 13,
                fontWeight: 600,
                wordBreak: "break-all",
              }}
            >
              {admin.username}
            </span>
            {isSelf && (
              <span
                style={badgeStyle(
                  "rgba(134,239,172,0.1)",
                  "rgba(134,239,172,0.25)",
                  "#86efac"
                )}
              >
                ME
              </span>
            )}
            <RoleBadgeInline role={admin.role} />
            <StatusBadgeInline status={admin.status} />
          </div>

          {admin.display_name && (
            <p
              style={{
                color: "rgba(245,240,232,0.35)",
                fontSize: 11,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {admin.display_name}
            </p>
          )}
          <p
            style={{
              color: "rgba(245,240,232,0.2)",
              fontSize: 10,
              marginTop: 3,
            }}
          >
            Last login:{" "}
            {admin.last_login_at
              ? new Date(admin.last_login_at).toLocaleString("en-GB", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </p>
        </div>

        {/* Detail link — stops propagation so it doesn't toggle expand */}
        <Link
          href={`/center-court/platform-admins/${admin.id}`}
          style={{ textDecoration: "none", flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(196,181,253,0.55)", border: "1px solid rgba(139,92,246,0.22)",
            borderRadius: 5, padding: "3px 9px", display: "inline-block",
          }}>
            Detail
          </span>
        </Link>

        {/* chevron — flex-shrink 0으로 밀리지 않게 */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M2 5l5 5 5-5"
            stroke="rgba(245,240,232,0.3)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* 확장 편집 패널 */}
      {expanded && (
        <div
          style={{
            padding: "16px 16px 18px",
            borderTop: "1px solid rgba(245,240,232,0.06)",
            background: "rgba(0,0,0,0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Display Name */}
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CcInput
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Display name"
                    disabled={patchBusy}
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={() => onPatch({ display_name: displayName })}
                  disabled={patchBusy}
                  style={smallBtnStyle}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <FieldLabel>Role</FieldLabel>
              <CcSelect
                value={admin.role}
                onChange={(v) => onPatch({ role: v })}
                disabled={patchBusy}
                options={[
                  { value: "admin", label: "ADMIN" },
                  { value: "owner", label: "OWNER" },
                ]}
              />
            </div>

            {/* New Password */}
            <div>
              <FieldLabel>New Password (min. 8 chars)</FieldLabel>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CcInput
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="New password"
                    disabled={patchBusy}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  onClick={() => {
                    if (newPassword.length >= 8) {
                      onPatch({ password: newPassword });
                      setNewPassword("");
                    }
                  }}
                  disabled={patchBusy || newPassword.length < 8}
                  style={smallBtnStyle}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Activate / Deactivate */}
            {!isSelf && (
              <button
                onClick={() =>
                  onPatch({ status: isActive ? "inactive" : "active" })
                }
                disabled={patchBusy}
                style={{
                  alignSelf: "flex-start",
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: isActive
                    ? "1px solid rgba(248,113,113,0.3)"
                    : "1px solid rgba(134,239,172,0.3)",
                  background: isActive
                    ? "rgba(248,113,113,0.08)"
                    : "rgba(134,239,172,0.08)",
                  color: isActive ? "#fca5a5" : "#86efac",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: patchBusy ? "not-allowed" : "pointer",
                  opacity: patchBusy ? 0.5 : 1,
                }}
              >
                {patchBusy ? "…" : isActive ? "Deactivate" : "Activate"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   스타일 상수
───────────────────────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  color: "rgba(196,181,253,0.45)",
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 8,
  fontFamily: "Georgia, serif",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 8,
  border: "1px solid rgba(245,240,232,0.14)",
  background: "rgba(245,240,232,0.04)",
  color: "#f5f0e8",
  fontSize: 13,
  padding: "0 12px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "0 14px",
  height: 40,
  flexShrink: 0,
  borderRadius: 7,
  background: "rgba(109,40,217,0.55)",
  border: "1px solid rgba(139,92,246,0.3)",
  color: "#f5f0e8",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const errorBoxStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.25)",
  background: "rgba(248,113,113,0.08)",
  padding: "10px 14px",
  color: "#fca5a5",
  fontSize: 12,
  marginBottom: 16,
};

const successBoxStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(134,239,172,0.25)",
  background: "rgba(134,239,172,0.08)",
  padding: "10px 14px",
  color: "#86efac",
  fontSize: 12,
  marginBottom: 16,
};

/* 카드 스타일 — purple (create form) */
const purpleCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(109,40,217,0.45)",
  background: "rgba(2,4,3,0.94)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  marginBottom: 20,
  boxShadow:
    "0 4px 22px rgba(0,0,0,0.6), inset 3px 0 0 rgba(109,40,217,0.5)",
};

/* 카드 스타일 — default (roster) */
const defaultCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(245,240,232,0.11)",
  background: "rgba(2,6,4,0.90)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  overflow: "hidden",
  marginBottom: 20,
  boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
};

function badgeStyle(
  bg: string,
  border: string,
  color: string
): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    padding: "2px 6px",
    borderRadius: 3,
    background: bg,
    border: `1px solid ${border}`,
    color,
    flexShrink: 0 as const,
    whiteSpace: "nowrap" as const,
  };
}

/* ─────────────────────────────────────────────────────────────
   서브 컴포넌트
───────────────────────────────────────────────────────────── */
function RoleBadgeInline({ role }: { role: string }) {
  return (
    <span
      style={badgeStyle(
        "rgba(139,92,246,0.15)",
        "rgba(139,92,246,0.35)",
        "#c4b5fd"
      )}
    >
      {role}
    </span>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      style={badgeStyle(
        active ? "rgba(134,239,172,0.1)" : "rgba(245,240,232,0.04)",
        active ? "rgba(134,239,172,0.25)" : "rgba(245,240,232,0.10)",
        active ? "#86efac" : "rgba(245,240,232,0.3)"
      )}
    >
      {status}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "rgba(245,240,232,0.38)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </p>
  );
}

function CcInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      className="cc-admin-input"
      style={{ ...inputStyle, opacity: disabled ? 0.45 : 1 }}
    />
  );
}

function CcSelect({
  value,
  onChange,
  disabled,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="cc-admin-select"
        style={{
          ...inputStyle,
          appearance: "none",
          paddingRight: 32,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* chevron */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          opacity: 0.45,
        }}
      >
        <path
          d="M2 4l4 4 4-4"
          stroke="#f5f0e8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
