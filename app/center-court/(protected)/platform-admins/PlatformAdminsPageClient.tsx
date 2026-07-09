"use client";

import { useState, useCallback } from "react";

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
        setCreateSuccess(`${data.admin.username} 계정이 생성되었습니다.`);
        setForm({ username: "", display_name: "", password: "", role: "admin" });
        setCreateOpen(false);
        await refreshAdmins();
      } else {
        const msg: Record<string, string> = {
          username_required: "아이디를 입력하세요.",
          password_too_short: "비밀번호는 8자 이상이어야 합니다.",
          invalid_role: "유효하지 않은 역할입니다.",
          username_taken: "이미 사용 중인 아이디입니다.",
        };
        setCreateError(msg[data.error] ?? "생성에 실패했습니다.");
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
          cannot_deactivate_self: "본인 계정은 비활성화할 수 없습니다.",
          last_owner_cannot_be_deactivated: "마지막 owner는 비활성화할 수 없습니다.",
          last_owner_cannot_be_demoted: "마지막 owner는 admin으로 강등할 수 없습니다.",
        };
        setPatchError(msg[data.error] ?? "변경에 실패했습니다.");
      }
    } finally {
      setPatchBusy(null);
    }
  }

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={labelStyle}>Platform Admins</p>
          <h1 style={{ color: "#f5f0e8", fontSize: 24, fontWeight: 700 }}>
            관리자 계정 관리
          </h1>
        </div>
        <button
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
            setCreateSuccess(null);
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "rgba(139,92,246,0.75)",
            border: "none",
            color: "#f5f0e8",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: "pointer",
          }}
        >
          + 관리자 추가
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

      {/* 신규 생성 폼 */}
      {createOpen && (
        <div style={courtCardStyle("rgba(139,92,246,0.08)", "rgba(139,92,246,0.2)")} className="mb-5">
          <p style={{ ...labelStyle, marginBottom: 14 }}>새 관리자 생성</p>
          <form onSubmit={handleCreate} noValidate>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <FieldLabel>아이디 *</FieldLabel>
                <CcInput
                  value={form.username}
                  onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                  placeholder="username"
                  disabled={createBusy}
                  autoComplete="off"
                />
              </div>
              <div>
                <FieldLabel>표시 이름</FieldLabel>
                <CcInput
                  value={form.display_name}
                  onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                  placeholder="관리자"
                  disabled={createBusy}
                  autoComplete="off"
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <FieldLabel>비밀번호 * (8자 이상)</FieldLabel>
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
                <FieldLabel>역할</FieldLabel>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as "owner" | "admin" }))
                  }
                  disabled={createBusy}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    backgroundImage: "none",
                  }}
                >
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </div>
            </div>

            {createError && <div style={{ ...errorBoxStyle, marginBottom: 12 }}>{createError}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={createBusy}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: createBusy ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.75)",
                  border: "none",
                  color: "#f5f0e8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: createBusy ? "not-allowed" : "pointer",
                }}
              >
                {createBusy ? "생성 중…" : "생성"}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(245,240,232,0.15)",
                  color: "rgba(245,240,232,0.5)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 관리자 목록 */}
      <div style={courtCardStyle()}>
        {admins.length === 0 ? (
          <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 13, textAlign: "center", padding: "24px 16px" }}>
            관리자 계정이 없습니다.
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

// ── AdminRow ──────────────────────────────────────────────────────────────

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
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ color: "#f5f0e8", fontSize: 13, fontWeight: 600 }}>
              {admin.username}
            </span>
            {isSelf && (
              <span style={{ ...badgeStyle("rgba(134,239,172,0.1)", "rgba(134,239,172,0.25)", "#86efac") }}>
                나
              </span>
            )}
            <RoleBadgeInline role={admin.role} />
            <StatusBadgeInline status={admin.status} />
          </div>
          {admin.display_name && (
            <p style={{ color: "rgba(245,240,232,0.35)", fontSize: 11 }}>
              {admin.display_name}
            </p>
          )}
          <p style={{ color: "rgba(245,240,232,0.2)", fontSize: 10, marginTop: 2 }}>
            마지막 로그인:{" "}
            {admin.last_login_at
              ? new Date(admin.last_login_at).toLocaleString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "없음"}
          </p>
        </div>
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
            padding: "0 16px 14px",
            borderTop: "1px solid rgba(245,240,232,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 표시 이름 변경 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>표시 이름</FieldLabel>
                <CcInput
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="표시 이름"
                  disabled={patchBusy}
                  autoComplete="off"
                />
              </div>
              <button
                onClick={() => onPatch({ display_name: displayName })}
                disabled={patchBusy}
                style={smallBtnStyle}
              >
                저장
              </button>
            </div>

            {/* 역할 변경 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>역할</FieldLabel>
                <select
                  defaultValue={admin.role}
                  disabled={patchBusy}
                  onChange={(e) => onPatch({ role: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </div>
            </div>

            {/* 비밀번호 재설정 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>새 비밀번호 (8자 이상)</FieldLabel>
                <CcInput
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="새 비밀번호"
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
                변경
              </button>
            </div>

            {/* 상태 토글 */}
            {!isSelf && (
              <button
                onClick={() =>
                  onPatch({ status: isActive ? "inactive" : "active" })
                }
                disabled={patchBusy}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: isActive
                    ? "1px solid rgba(248,113,113,0.3)"
                    : "1px solid rgba(134,239,172,0.3)",
                  background: isActive
                    ? "rgba(248,113,113,0.08)"
                    : "rgba(134,239,172,0.08)",
                  color: isActive ? "#fca5a5" : "#86efac",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: patchBusy ? "not-allowed" : "pointer",
                  opacity: patchBusy ? 0.5 : 1,
                }}
              >
                {patchBusy ? "…" : isActive ? "비활성화" : "활성화"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 공통 스타일/컴포넌트 ────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  color: "rgba(245,240,232,0.3)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 8,
  border: "1px solid rgba(245,240,232,0.12)",
  background: "rgba(245,240,232,0.04)",
  color: "#f5f0e8",
  fontSize: 13,
  padding: "0 12px",
  outline: "none",
  boxSizing: "border-box",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  marginTop: 18,
  borderRadius: 7,
  background: "rgba(139,92,246,0.6)",
  border: "none",
  color: "#f5f0e8",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
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

function courtCardStyle(
  bg = "rgba(245,240,232,0.04)",
  border = "rgba(245,240,232,0.10)"
): React.CSSProperties {
  return {
    borderRadius: 14,
    border: `1px solid ${border}`,
    background: bg,
    overflow: "hidden",
    marginBottom: 20,
  };
}

function badgeStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    padding: "1px 6px",
    borderRadius: 3,
    background: bg,
    border: `1px solid ${border}`,
    color,
    flexShrink: 0 as const,
  };
}

function RoleBadgeInline({ role }: { role: string }) {
  return (
    <span style={badgeStyle("rgba(139,92,246,0.15)", "rgba(139,92,246,0.35)", "#c4b5fd")}>
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
        color: "rgba(245,240,232,0.35)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: 5,
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
      style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}
    />
  );
}
