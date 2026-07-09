"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type EntityType = "club" | "member" | "match" | "activity";

interface DemoEntity {
  id: string;
  entity_type: EntityType;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

type Tab = "clubs" | "members" | "matches" | "activity";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  cream: "#f5f0e8",
  creamDim: "rgba(245,240,232,0.55)",
  creamFaint: "rgba(245,240,232,0.12)",
  purple: "#c4b5fd",
  purpleDim: "rgba(196,181,253,0.25)",
  purpleFaint: "rgba(196,181,253,0.10)",
  green: "#86efac",
  amber: "#fbbf24",
  red: "#f87171",
  panel: "rgba(2,6,4,0.82)",
  border: "rgba(245,240,232,0.10)",
  borderActive: "rgba(196,181,253,0.35)",
} as const;

const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLES = ["master", "admin", "manager", "member"] as const;
type Role = (typeof ROLES)[number];

function roleBadgeColor(role: string): string {
  if (role === "master") return C.purple;
  if (role === "admin") return C.amber;
  if (role === "manager") return C.green;
  return C.creamDim;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: sans,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: roleBadgeColor(role),
        border: `1px solid ${roleBadgeColor(role)}`,
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      {role}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(2,6,4,0.96)",
        border: `1px solid ${C.purpleDim}`,
        color: C.cream,
        fontFamily: sans,
        fontSize: 13,
        padding: "10px 20px",
        borderRadius: 10,
        zIndex: 1000,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        whiteSpace: "nowrap",
      }}
    >
      {msg}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function Card({
  children,
  active,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${active ? C.borderActive : C.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Btn ──────────────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  variant = "default",
  small,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "danger" | "purple";
  small?: boolean;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    fontFamily: sans,
    fontSize: small ? 11 : 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid",
    borderRadius: 8,
    padding: small ? "4px 10px" : "8px 16px",
    transition: "opacity 0.15s",
    opacity: disabled ? 0.4 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
  const variants: Record<string, React.CSSProperties> = {
    default: {
      background: "rgba(245,240,232,0.08)",
      borderColor: C.border,
      color: C.cream,
    },
    ghost: {
      background: "transparent",
      borderColor: C.border,
      color: C.creamDim,
    },
    danger: {
      background: "rgba(248,113,113,0.08)",
      borderColor: "rgba(248,113,113,0.3)",
      color: C.red,
    },
    purple: {
      background: C.purpleDim,
      borderColor: C.borderActive,
      color: C.purple,
    },
  };
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Input({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: sans,
        fontSize: 13,
        background: "rgba(245,240,232,0.05)",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        color: C.cream,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: sans,
        fontSize: 13,
        background: "#0a1a0a",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        color: C.cream,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Clubs panel ───────────────────────────────────────────────────────────────

function ClubsPanel({
  clubs,
  onRefresh,
  onToast,
}: {
  clubs: DemoEntity[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "club",
        payload: { name: name.trim(), description: desc.trim(), status: "active" },
      }),
    });
    setName("");
    setDesc("");
    setShowForm(false);
    setLoading(false);
    onToast("클럽이 추가되었습니다.");
    onRefresh();
  }

  async function handleEdit(id: string) {
    await fetch(`/api/demo/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { name: editName, description: editDesc } }),
    });
    setEditId(null);
    onToast("클럽 정보가 수정되었습니다.");
    onRefresh();
  }

  async function handleDelete(id: string, cname: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast(`'${cname}' 클럽이 삭제되었습니다.`);
    onRefresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: "0.2em", color: C.creamDim, textTransform: "uppercase" }}>
          {clubs.length} Club{clubs.length !== 1 ? "s" : ""}
        </p>
        <Btn variant="purple" small onClick={() => setShowForm(!showForm)}>
          {showForm ? "취소" : "+ 클럽 추가"}
        </Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: sans, fontSize: 11, color: C.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>New Club</p>
            <Input value={name} onChange={setName} placeholder="클럽 이름 *" />
            <Input value={desc} onChange={setDesc} placeholder="한 줄 소개 (선택)" />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" small onClick={() => setShowForm(false)}>취소</Btn>
              <Btn variant="purple" small onClick={handleAdd} disabled={loading || !name.trim()}>추가</Btn>
            </div>
          </div>
        </Card>
      )}

      {clubs.map((c) => {
        const p = c.payload;
        const isEditing = editId === c.id;
        return (
          <Card key={c.id} active={isEditing}>
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input value={editName} onChange={setEditName} placeholder="클럽 이름" />
                <Input value={editDesc} onChange={setEditDesc} placeholder="한 줄 소개" />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Btn variant="ghost" small onClick={() => setEditId(null)}>취소</Btn>
                  <Btn variant="purple" small onClick={() => handleEdit(c.id)}>저장</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontFamily: serif, fontSize: 15, color: C.cream, marginBottom: 4 }}>{String(p.name ?? "")}</p>
                  {!!p.description && (
                    <p style={{ fontFamily: sans, fontSize: 12, color: C.creamDim }}>{String(p.description)}</p>
                  )}
                  <p style={{ fontFamily: sans, fontSize: 10, color: "rgba(245,240,232,0.3)", marginTop: 6 }}>
                    Status: {String(p.status ?? "active")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn variant="ghost" small onClick={() => { setEditId(c.id); setEditName(String(p.name ?? "")); setEditDesc(String(p.description ?? "")); }}>수정</Btn>
                  <Btn variant="danger" small onClick={() => handleDelete(c.id, String(p.name ?? ""))}>삭제</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {clubs.length === 0 && !showForm && (
        <p style={{ fontFamily: sans, fontSize: 13, color: C.creamDim, textAlign: "center", padding: "24px 0" }}>
          클럽이 없습니다. 위 버튼으로 추가해보세요.
        </p>
      )}
    </div>
  );
}

// ── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({
  members,
  clubs,
  onRefresh,
  onToast,
}: {
  members: DemoEntity[];
  clubs: DemoEntity[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [clubId, setClubId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>("member");

  const clubOptions = clubs.map((c) => ({
    value: c.id,
    label: String(c.payload.name ?? c.id),
  }));

  async function handleAdd() {
    if (!name.trim() || !clubId) return;
    setLoading(true);
    const club = clubs.find((c) => c.id === clubId);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "member",
        payload: {
          name: name.trim(),
          role,
          club_id: clubId,
          club_name: club ? String(club.payload.name) : "",
          is_active: true,
        },
      }),
    });
    setName("");
    setRole("member");
    setClubId("");
    setShowForm(false);
    setLoading(false);
    onToast("회원이 추가되었습니다.");
    onRefresh();
  }

  async function handleRoleChange(id: string, newRole: Role) {
    await fetch(`/api/demo/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { role: newRole } }),
    });
    setEditId(null);
    onToast(`역할이 '${newRole}'로 변경되었습니다.`);
    onRefresh();
  }

  async function handleDelete(id: string, mname: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast(`'${mname}' 회원이 삭제되었습니다.`);
    onRefresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: "0.2em", color: C.creamDim, textTransform: "uppercase" }}>
          {members.length} Member{members.length !== 1 ? "s" : ""}
        </p>
        <Btn variant="purple" small onClick={() => setShowForm(!showForm)} disabled={clubs.length === 0}>
          {showForm ? "취소" : "+ 회원 추가"}
        </Btn>
      </div>

      {clubs.length === 0 && (
        <p style={{ fontFamily: sans, fontSize: 12, color: C.amber, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 14px" }}>
          먼저 클럽을 추가해야 회원을 등록할 수 있습니다.
        </p>
      )}

      {showForm && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: sans, fontSize: 11, color: C.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>New Member</p>
            <Input value={name} onChange={setName} placeholder="회원 이름 *" />
            <Select value={clubId} onChange={setClubId} options={[{ value: "", label: "클럽 선택 *" }, ...clubOptions]} />
            <Select
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={ROLES.map((r) => ({ value: r, label: r === "master" ? "master (CENTER COURT 시연용)" : r }))}
            />
            <p style={{ fontFamily: sans, fontSize: 11, color: C.creamDim, lineHeight: 1.5 }}>
              💡 데모에서는 master 포함 전체 역할을 자유롭게 배정할 수 있습니다.
              <br />실제 /admin 패널에서는 master 변경이 CENTER COURT로 제한됩니다.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" small onClick={() => setShowForm(false)}>취소</Btn>
              <Btn variant="purple" small onClick={handleAdd} disabled={loading || !name.trim() || !clubId}>추가</Btn>
            </div>
          </div>
        </Card>
      )}

      {members.map((m) => {
        const p = m.payload;
        const isEditing = editId === m.id;
        return (
          <Card key={m.id} active={isEditing}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ fontFamily: serif, fontSize: 15, color: C.cream }}>{String(p.name ?? "")}</p>
                  <RoleBadge role={String(p.role ?? "member")} />
                </div>
                <p style={{ fontFamily: sans, fontSize: 11, color: C.creamDim }}>{String(p.club_name ?? "")}</p>
                {isEditing && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Select
                      value={editRole}
                      onChange={(v) => setEditRole(v as Role)}
                      options={ROLES.map((r) => ({ value: r, label: r === "master" ? "master (CENTER COURT 시연용)" : r }))}
                      style={{ width: 200 }}
                    />
                    <Btn variant="purple" small onClick={() => handleRoleChange(m.id, editRole)}>저장</Btn>
                    <Btn variant="ghost" small onClick={() => setEditId(null)}>취소</Btn>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn variant="ghost" small onClick={() => { setEditId(m.id); setEditRole((p.role as Role) ?? "member"); }}>역할 변경</Btn>
                  <Btn variant="danger" small onClick={() => handleDelete(m.id, String(p.name ?? ""))}>삭제</Btn>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {members.length === 0 && !showForm && (
        <p style={{ fontFamily: sans, fontSize: 13, color: C.creamDim, textAlign: "center", padding: "24px 0" }}>
          등록된 회원이 없습니다.
        </p>
      )}
    </div>
  );
}

// ── Matches panel ─────────────────────────────────────────────────────────────

function MatchesPanel({
  matches,
  clubs,
  onRefresh,
  onToast,
}: {
  matches: DemoEntity[];
  clubs: DemoEntity[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [type, setType] = useState<"singles" | "doubles">("doubles");
  const [clubId, setClubId] = useState("");
  const [loading, setLoading] = useState(false);

  const clubOptions = clubs.map((c) => ({
    value: c.id,
    label: String(c.payload.name ?? c.id),
  }));

  async function handleAdd() {
    if (!title.trim() || !clubId) return;
    setLoading(true);
    const club = clubs.find((c) => c.id === clubId);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "match",
        payload: {
          title: title.trim(),
          score: score.trim(),
          type,
          club_id: clubId,
          club_name: club ? String(club.payload.name) : "",
          status: "completed",
          played_at: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    setTitle("");
    setScore("");
    setType("doubles");
    setClubId("");
    setShowForm(false);
    setLoading(false);
    onToast("경기가 기록되었습니다.");
    onRefresh();
  }

  async function handleDelete(id: string, mtitle: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast(`'${mtitle}' 경기가 삭제되었습니다.`);
    onRefresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: "0.2em", color: C.creamDim, textTransform: "uppercase" }}>
          {matches.length} Match{matches.length !== 1 ? "es" : ""}
        </p>
        <Btn variant="purple" small onClick={() => setShowForm(!showForm)} disabled={clubs.length === 0}>
          {showForm ? "취소" : "+ 경기 기록"}
        </Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: sans, fontSize: 11, color: C.purple, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>New Match</p>
            <Input value={title} onChange={setTitle} placeholder="경기 제목 *" />
            <Input value={score} onChange={setScore} placeholder="스코어 (예: 6-4, 7-5)" />
            <Select value={clubId} onChange={setClubId} options={[{ value: "", label: "클럽 선택 *" }, ...clubOptions]} />
            <Select value={type} onChange={(v) => setType(v as "singles" | "doubles")} options={[{ value: "doubles", label: "Doubles" }, { value: "singles", label: "Singles" }]} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" small onClick={() => setShowForm(false)}>취소</Btn>
              <Btn variant="purple" small onClick={handleAdd} disabled={loading || !title.trim() || !clubId}>기록</Btn>
            </div>
          </div>
        </Card>
      )}

      {matches.map((m) => {
        const p = m.payload;
        return (
          <Card key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontFamily: serif, fontSize: 15, color: C.cream }}>{String(p.title ?? "")}</p>
                  <span style={{ fontFamily: sans, fontSize: 10, color: C.creamDim, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px" }}>
                    {String(p.type ?? "doubles")}
                  </span>
                </div>
                {!!p.score && (
                  <p style={{ fontFamily: "monospace", fontSize: 13, color: C.green, marginBottom: 4 }}>{String(p.score)}</p>
                )}
                <p style={{ fontFamily: sans, fontSize: 11, color: C.creamDim }}>
                  {String(p.club_name ?? "")} · {String(p.played_at ?? "").slice(0, 10)}
                </p>
              </div>
              <Btn variant="danger" small onClick={() => handleDelete(m.id, String(p.title ?? ""))}>삭제</Btn>
            </div>
          </Card>
        );
      })}

      {matches.length === 0 && !showForm && (
        <p style={{ fontFamily: sans, fontSize: 13, color: C.creamDim, textAlign: "center", padding: "24px 0" }}>
          기록된 경기가 없습니다.
        </p>
      )}
    </div>
  );
}

// ── Activity panel ────────────────────────────────────────────────────────────

function ActivityPanel({ activities }: { activities: DemoEntity[] }) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  function typeColor(entityType: string): string {
    if (entityType === "club") return C.green;
    if (entityType === "member") return C.purple;
    if (entityType === "match") return C.amber;
    return C.creamDim;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: "0.2em", color: C.creamDim, textTransform: "uppercase", marginBottom: 4 }}>
        {sorted.length} Event{sorted.length !== 1 ? "s" : ""}
      </p>

      {sorted.map((a) => {
        const p = a.payload;
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 14px",
              background: "rgba(245,240,232,0.03)",
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${typeColor(String(p.entity_type ?? ""))}`,
              borderRadius: "0 8px 8px 0",
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: sans, fontSize: 13, color: C.cream, marginBottom: 2 }}>{String(p.action ?? "")}</p>
              {!!p.entity_name && (
                <p style={{ fontFamily: sans, fontSize: 11, color: C.creamDim }}>{String(p.entity_name)}</p>
              )}
            </div>
            <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(245,240,232,0.3)", flexShrink: 0 }}>
              {new Date(String(p.timestamp ?? a.created_at)).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <p style={{ fontFamily: sans, fontSize: 13, color: C.creamDim, textAlign: "center", padding: "24px 0" }}>
          아직 활동 기록이 없습니다.
        </p>
      )}
    </div>
  );
}

// ── Session timer ─────────────────────────────────────────────────────────────

function SessionTimer({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("만료됨");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!remaining) return null;

  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        color: remaining === "만료됨" ? C.red : C.creamDim,
        background: "rgba(245,240,232,0.05)",
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "3px 8px",
        letterSpacing: "0.05em",
      }}
    >
      ⏱ {remaining}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "clubs", label: "Clubs" },
  { key: "members", label: "Members" },
  { key: "matches", label: "Matches" },
  { key: "activity", label: "Activity" },
];

export default function DemoPageClient() {
  const [tab, setTab] = useState<Tab>("clubs");
  const [entities, setEntities] = useState<DemoEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const clubs = entities.filter((e) => e.entity_type === "club");
  const members = entities.filter((e) => e.entity_type === "member");
  const matches = entities.filter((e) => e.entity_type === "match");
  const activities = entities.filter((e) => e.entity_type === "activity");

  const expiresAt =
    entities.length > 0
      ? entities.reduce((latest, e) =>
          e.expires_at > latest ? e.expires_at : latest,
          entities[0].expires_at
        )
      : null;

  const loadEntities = useCallback(async () => {
    const res = await fetch("/api/demo/entities");
    if (res.ok) {
      const data = await res.json();
      setEntities(data.entities ?? []);
    } else if (res.status === 401) {
      window.location.href = "/api/demo/init";
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  async function handleReset() {
    setResetting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    await loadEntities();
    setResetting(false);
    setTab("clubs");
    setToast("데모가 초기 상태로 초기화되었습니다.");
  }

  const showToast = useCallback((msg: string) => setToast(msg), []);

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Header */}
      <header
        style={{
          padding: "28px 20px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(2,6,4,0.6)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p
                style={{
                  fontFamily: serif,
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  color: C.purple,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Super Match · Platform Demo
              </p>
              <h1
                style={{
                  fontFamily: serif,
                  fontSize: 22,
                  fontWeight: "normal",
                  color: C.cream,
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                Experience Mode
              </h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <SessionTimer expiresAt={expiresAt} />
              <Btn variant="ghost" small onClick={handleReset} disabled={resetting}>
                {resetting ? "초기화 중…" : "↺ Reset"}
              </Btn>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* Demo notice */}
        <div
          style={{
            margin: "20px 0",
            padding: "12px 16px",
            background: "rgba(196,181,253,0.06)",
            border: `1px solid rgba(196,181,253,0.18)`,
            borderRadius: 10,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🎾</span>
          <div>
            <p style={{ fontFamily: sans, fontSize: 13, color: C.cream, marginBottom: 4 }}>
              체험 데모 모드입니다.
            </p>
            <p style={{ fontFamily: sans, fontSize: 12, color: C.creamDim, lineHeight: 1.6 }}>
              로그인 없이 SUPER MATCH 플랫폼의 클럽·회원·경기 관리 기능을 둘러볼 수 있습니다.
              입력한 데이터는 실서비스에 영향을 주지 않으며, 세션 종료(1시간) 후 자동 삭제됩니다.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: sans,
                fontSize: 13,
                fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? C.purple : C.creamDim,
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${tab === t.key ? C.purple : "transparent"}`,
                padding: "8px 14px",
                cursor: "pointer",
                transition: "color 0.15s",
                marginBottom: -1,
              }}
            >
              {t.label}
              {t.key === "clubs" && clubs.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.creamDim }}>{clubs.length}</span>
              )}
              {t.key === "members" && members.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.creamDim }}>{members.length}</span>
              )}
              {t.key === "matches" && matches.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.creamDim }}>{matches.length}</span>
              )}
              {t.key === "activity" && activities.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.creamDim }}>{activities.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Panel */}
        {loading ? (
          <p style={{ fontFamily: sans, fontSize: 13, color: C.creamDim, textAlign: "center", padding: "40px 0" }}>
            로딩 중…
          </p>
        ) : (
          <>
            {tab === "clubs" && (
              <ClubsPanel clubs={clubs} onRefresh={loadEntities} onToast={showToast} />
            )}
            {tab === "members" && (
              <MembersPanel members={members} clubs={clubs} onRefresh={loadEntities} onToast={showToast} />
            )}
            {tab === "matches" && (
              <MatchesPanel matches={matches} clubs={clubs} onRefresh={loadEntities} onToast={showToast} />
            )}
            {tab === "activity" && <ActivityPanel activities={activities} />}
          </>
        )}

        {/* Footer note */}
        <div
          style={{
            marginTop: 40,
            padding: "14px 16px",
            background: "rgba(245,240,232,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
          }}
        >
          <p style={{ fontFamily: sans, fontSize: 11, color: "rgba(245,240,232,0.35)", lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: C.creamDim }}>데모 정책 안내</strong><br />
            · 데이터는 이 세션에만 격리됩니다 — 다른 방문자와 공유되지 않습니다.<br />
            · 실서비스 DB(members, matches, clubs 등)에는 어떤 write도 발생하지 않습니다.<br />
            · master 역할 배정은 데모 시연 목적입니다. 실제 /admin 패널에서는 CENTER COURT만 master를 제어합니다.
          </p>
        </div>
      </main>
    </>
  );
}
