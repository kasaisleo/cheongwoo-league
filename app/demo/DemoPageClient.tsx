"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PlatformHomeLink } from "@/components/navigation/PlatformHomeLink";

// ─── Types ───────────────────────────────────────────────────────────────────

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
type Role = "master" | "admin" | "manager" | "member";
const ROLES: Role[] = ["master", "admin", "manager", "member"];

// ─── Design tokens ───────────────────────────────────────────────────────────

const C = {
  panel:     "rgba(5,10,8,0.94)",
  border:    "rgba(245,239,218,0.14)",
  borderHi:  "rgba(185,156,255,0.38)",
  cream:     "#f5efda",
  muted:     "#a9b8a6",
  purple:    "#b99cff",
  purpleBg:  "rgba(143,107,255,0.16)",
  purpleBdr: "rgba(185,156,255,0.30)",
  green:     "#6abf7b",
  amber:     "#d4a843",
  red:       "#d96060",
  headerBg:  "rgba(2,9,5,0.97)",
} as const;

const serif = "Georgia, 'Times New Roman', serif";
const mono  = "'Courier New', monospace";
const sans  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── CSS injection ───────────────────────────────────────────────────────────

function DemoStyles() {
  return (
    <style>{`
      /* ── Header ── */
      .d-header {
        position: sticky; top: 0; z-index: 100;
        background: rgba(2,9,5,0.97);
        border-bottom: 1px solid rgba(245,239,218,0.09);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }
      .d-header-inner {
        max-width: 880px; margin: 0 auto;
        padding: 11px 20px;
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
      }

      /* ── Main ── */
      .d-main {
        max-width: 880px; margin: 0 auto;
        padding: 24px 20px 80px;
      }

      /* ── Stats grid ── */
      .d-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 9px;
        margin: 14px 0 12px;
      }
      @media (min-width: 560px) {
        .d-stats { grid-template-columns: repeat(4, 1fr); }
      }
      .d-stat-card {
        background: rgba(5,10,8,0.92);
        border: 1px solid rgba(245,239,218,0.11);
        border-radius: 10px;
        padding: 13px 14px 11px;
        text-align: center;
        transition: border-color 0.15s;
      }
      .d-stat-card:hover { border-color: rgba(185,156,255,0.22); }

      /* ── Tabs ── */
      .d-tab-bar {
        display: flex;
        border-bottom: 1px solid rgba(245,239,218,0.10);
        margin-bottom: 18px;
        overflow-x: auto; scrollbar-width: none;
      }
      .d-tab-bar::-webkit-scrollbar { display: none; }
      .d-tab-btn {
        flex-shrink: 0;
        padding: 9px 15px;
        background: transparent; border: none;
        border-bottom: 2px solid transparent;
        color: rgba(169,184,166,0.55);
        font-family: ${serif};
        font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
        cursor: pointer; white-space: nowrap;
        transition: color 0.15s;
        margin-bottom: -1px;
      }
      .d-tab-btn:hover { color: #b99cff; }
      .d-tab-btn.active { color: #f5efda; border-bottom-color: #b99cff; }

      /* ── Cards ── */
      .d-card {
        background: rgba(5,10,8,0.92);
        border: 1px solid rgba(245,239,218,0.11);
        border-radius: 11px;
        padding: 13px 16px;
        margin-bottom: 9px;
        transition: border-color 0.15s;
      }
      .d-card:hover { border-color: rgba(245,239,218,0.18); }
      .d-card.editing { border-color: rgba(185,156,255,0.34); }

      /* ── Add form ── */
      .d-form {
        background: rgba(5,10,8,0.92);
        border: 1px solid rgba(185,156,255,0.24);
        border-radius: 11px;
        padding: 16px 18px;
        margin-bottom: 12px;
      }
      .d-form-row { display: flex; flex-direction: column; gap: 10px; }
      .d-form-actions {
        display: flex; gap: 8px;
        justify-content: flex-end; margin-top: 4px;
      }

      /* ── Inputs ── */
      .d-input {
        width: 100%; box-sizing: border-box;
        background: rgba(1,6,3,0.90);
        border: 1px solid rgba(245,239,218,0.15);
        border-radius: 8px; padding: 9px 13px;
        color: #f5efda; font-size: 13px; font-family: ${sans};
        outline: none; transition: border-color 0.15s;
      }
      .d-input:focus { border-color: rgba(185,156,255,0.42); }
      .d-input::placeholder { color: rgba(169,184,166,0.40); }

      .d-select {
        width: 100%; box-sizing: border-box;
        background: #010904;
        border: 1px solid rgba(245,239,218,0.15);
        border-radius: 8px; padding: 9px 13px;
        color: #f5efda; font-size: 13px; font-family: ${sans};
        outline: none; cursor: pointer;
        transition: border-color 0.15s;
      }
      .d-select:focus { border-color: rgba(185,156,255,0.42); }

      /* ── Buttons ── */
      .d-btn-purple {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 8px 15px;
        background: rgba(143,107,255,0.17);
        border: 1px solid rgba(185,156,255,0.32);
        border-radius: 8px; color: #b99cff;
        font-size: 11px; font-family: ${sans}; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase;
        cursor: pointer; transition: background 0.15s, border-color 0.15s;
      }
      .d-btn-purple:hover {
        background: rgba(143,107,255,0.30);
        border-color: rgba(185,156,255,0.52);
      }
      .d-btn-purple:disabled { opacity: 0.38; cursor: not-allowed; }

      .d-btn-ghost {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 13px;
        background: transparent;
        border: 1px solid rgba(245,239,218,0.15);
        border-radius: 8px; color: rgba(169,184,166,0.62);
        font-size: 11px; font-family: ${sans}; font-weight: 600;
        letter-spacing: 0.06em; text-transform: uppercase;
        cursor: pointer; transition: color 0.15s, border-color 0.15s;
      }
      .d-btn-ghost:hover {
        color: #f5efda; border-color: rgba(245,239,218,0.28);
      }
      .d-btn-ghost:disabled { opacity: 0.34; cursor: not-allowed; }

      .d-btn-danger {
        display: inline-flex; align-items: center;
        padding: 5px 10px;
        background: rgba(217,96,96,0.07);
        border: 1px solid rgba(217,96,96,0.22);
        border-radius: 7px; color: #d96060;
        font-size: 10px; font-family: ${sans}; font-weight: 600;
        letter-spacing: 0.07em; text-transform: uppercase;
        cursor: pointer; transition: background 0.15s;
      }
      .d-btn-danger:hover {
        background: rgba(217,96,96,0.14);
        border-color: rgba(217,96,96,0.36);
      }

      /* size modifier — applies to both purple and ghost */
      .d-sm { padding: 5px 10px !important; font-size: 10px !important; }

      /* back link */
      .d-back-link {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 11px;
        border: 1px solid rgba(245,239,218,0.14);
        border-radius: 7px; color: rgba(169,184,166,0.62);
        text-decoration: none;
        font-size: 10px; font-family: ${sans}; font-weight: 600;
        letter-spacing: 0.08em; text-transform: uppercase;
        transition: color 0.15s, border-color 0.15s;
      }
      .d-back-link:hover {
        color: #f5efda; border-color: rgba(245,239,218,0.28);
      }

      /* activity feed */
      .d-activity-wrap {
        background: rgba(5,10,8,0.92);
        border: 1px solid rgba(245,239,218,0.11);
        border-radius: 11px; overflow: hidden;
      }
      .d-activity-row {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(245,239,218,0.06);
      }
      .d-activity-row:last-child { border-bottom: none; }

      /* section header */
      .d-section-hdr {
        display: flex; justify-content: space-between;
        align-items: center; margin-bottom: 14px;
      }
      .d-section-label {
        font-family: ${serif}; font-size: 10px;
        letter-spacing: 0.20em; text-transform: uppercase;
        color: rgba(169,184,166,0.65);
      }

      /* policy notice */
      .d-policy {
        display: flex; flex-wrap: wrap; gap: 2px 0;
        padding: 9px 14px;
        background: rgba(143,107,255,0.05);
        border: 1px solid rgba(185,156,255,0.12);
        border-radius: 9px; margin-bottom: 20px;
      }
      .d-policy-item {
        display: inline-flex; align-items: center; gap: 5px;
        font-family: ${sans}; font-size: 11px;
        color: rgba(185,156,255,0.62);
        padding-right: 14px;
      }

      /* session timer */
      .d-timer {
        font-family: ${mono}; font-size: 11px; letter-spacing: 0.06em;
        background: rgba(245,239,218,0.05);
        border: 1px solid rgba(245,239,218,0.11);
        border-radius: 6px; padding: 4px 9px;
      }

      @media (max-width: 360px) {
        .d-timer { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { transition: none !important; animation: none !important; }
      }
    `}</style>
  );
}

// ─── Session timer ────────────────────────────────────────────────────────────

function SessionTimer({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState("");
  const [low, setLow] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("EXPIRED"); setLow(true); return; }
      setLow(diff < 600_000);
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!remaining) return null;
  return (
    <span className="d-timer" style={{ color: low ? C.red : C.muted }}>
      ⏱ {remaining}
    </span>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(2,9,5,0.97)",
      border: `1px solid ${C.purpleBdr}`,
      color: C.cream, fontFamily: sans, fontSize: 13, lineHeight: 1.5,
      padding: "11px 22px", borderRadius: 10, zIndex: 10000,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      maxWidth: "calc(100vw - 40px)", textAlign: "center",
    }}>
      {msg}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; border: string }> = {
  master:  { color: C.purple, border: C.purpleBdr },
  admin:   { color: C.amber,  border: "rgba(212,168,67,0.30)" },
  manager: { color: C.green,  border: "rgba(106,191,123,0.30)" },
  member:  { color: C.muted,  border: "rgba(169,184,166,0.26)" },
};

function RoleBadge({ role }: { role: string }) {
  const { color, border } = ROLE_COLORS[role] ?? ROLE_COLORS.member;
  return (
    <span style={{
      fontSize: 9, fontFamily: sans, fontWeight: 700,
      letterSpacing: "0.10em", textTransform: "uppercase",
      color, border: `1px solid ${border}`,
      borderRadius: 4, padding: "2px 7px",
    }}>
      {role}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="d-stat-card">
      <p style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: accent ?? C.cream, marginBottom: 3 }}>
        {value}
      </p>
      <p style={{ fontFamily: sans, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

// ─── Clubs panel ─────────────────────────────────────────────────────────────

function ClubsPanel({ clubs, onRefresh, onToast }: {
  clubs: DemoEntity[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "club",
        payload: { name: name.trim(), description: desc.trim(), status: "active" },
      }),
    });
    setName(""); setDesc(""); setShowForm(false); setSaving(false);
    onToast("데모 데이터가 추가되었습니다. 실제 서비스에는 저장되지 않습니다.");
    onRefresh();
  }

  async function handleEdit(id: string) {
    await fetch(`/api/demo/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { name: editName, description: editDesc } }),
    });
    setEditId(null);
    onToast("데모 데이터가 수정되었습니다.");
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast("데모 데이터가 삭제되었습니다.");
    onRefresh();
  }

  return (
    <div>
      <div className="d-section-hdr">
        <span className="d-section-label">{clubs.length} Club{clubs.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          className="d-btn-purple d-sm"
          onClick={() => { setShowForm(!showForm); setEditId(null); }}
        >
          {showForm ? "Cancel" : "Add Club"}
        </button>
      </div>

      {showForm && (
        <div className="d-form">
          <p style={{ fontFamily: serif, fontSize: 9, letterSpacing: "0.22em", color: C.purple, textTransform: "uppercase", marginBottom: 12 }}>
            New Club
          </p>
          <div className="d-form-row">
            <input className="d-input" value={name} onChange={e => setName(e.target.value)} placeholder="Club name *" autoFocus />
            <input className="d-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" />
            <div className="d-form-actions">
              <button type="button" className="d-btn-ghost d-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="d-btn-purple d-sm" onClick={handleAdd} disabled={saving || !name.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {clubs.map(c => {
        const p = c.payload;
        const isEditing = editId === c.id;
        return (
          <div key={c.id} className={`d-card${isEditing ? " editing" : ""}`}>
            {isEditing ? (
              <div className="d-form-row">
                <input className="d-input" value={editName} onChange={e => setEditName(e.target.value)} />
                <input className="d-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                <div className="d-form-actions">
                  <button type="button" className="d-btn-ghost d-sm" onClick={() => setEditId(null)}>Cancel</button>
                  <button type="button" className="d-btn-purple d-sm" onClick={() => handleEdit(c.id)}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.purple, flexShrink: 0 }} />
                    <p style={{ fontFamily: serif, fontSize: 14, color: C.cream }}>{String(p.name ?? "")}</p>
                  </div>
                  {!!p.description && (
                    <p style={{ fontFamily: sans, fontSize: 11, color: C.muted, paddingLeft: 12 }}>{String(p.description)}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="d-btn-ghost d-sm"
                    onClick={() => { setEditId(c.id); setEditName(String(p.name ?? "")); setEditDesc(String(p.description ?? "")); setShowForm(false); }}
                  >
                    Edit
                  </button>
                  <button type="button" className="d-btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {clubs.length === 0 && !showForm && (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: serif, fontSize: 13, color: C.muted }}>No clubs yet.</p>
          <p style={{ fontFamily: sans, fontSize: 11, color: "rgba(169,184,166,0.45)", marginTop: 4 }}>
            Click <strong style={{ color: C.purple }}>Add Club</strong> to create the first one.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Members panel ────────────────────────────────────────────────────────────

function MembersPanel({ members, clubs, onRefresh, onToast }: {
  members: DemoEntity[];
  clubs: DemoEntity[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [clubId, setClubId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>("member");

  async function handleAdd() {
    if (!name.trim() || !clubId) return;
    setSaving(true);
    const club = clubs.find(c => c.id === clubId);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "member",
        payload: {
          name: name.trim(), role, club_id: clubId,
          club_name: club ? String(club.payload.name) : "",
          is_active: true,
        },
      }),
    });
    setName(""); setRole("member"); setClubId(""); setShowForm(false); setSaving(false);
    onToast("데모 데이터가 추가되었습니다. 실제 서비스에는 저장되지 않습니다.");
    onRefresh();
  }

  async function handleRoleChange(id: string, newRole: Role) {
    await fetch(`/api/demo/entities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { role: newRole } }),
    });
    setEditId(null);
    onToast("데모 데이터가 수정되었습니다.");
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast("데모 데이터가 삭제되었습니다.");
    onRefresh();
  }

  return (
    <div>
      <div className="d-section-hdr">
        <span className="d-section-label">{members.length} Member{members.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          className="d-btn-purple d-sm"
          onClick={() => { setShowForm(!showForm); setEditId(null); }}
          disabled={clubs.length === 0}
        >
          {showForm ? "Cancel" : "Add Member"}
        </button>
      </div>

      {clubs.length === 0 && (
        <p style={{
          fontFamily: sans, fontSize: 12, color: C.amber,
          background: "rgba(212,168,67,0.07)", border: "1px solid rgba(212,168,67,0.18)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
        }}>
          클럽을 먼저 추가해야 회원을 등록할 수 있습니다.
        </p>
      )}

      {showForm && (
        <div className="d-form">
          <p style={{ fontFamily: serif, fontSize: 9, letterSpacing: "0.22em", color: C.purple, textTransform: "uppercase", marginBottom: 12 }}>
            New Member
          </p>
          <div className="d-form-row">
            <input className="d-input" value={name} onChange={e => setName(e.target.value)} placeholder="Member name *" autoFocus />
            <select className="d-select" value={clubId} onChange={e => setClubId(e.target.value)}>
              <option value="">Select club *</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{String(c.payload.name ?? c.id)}</option>)}
            </select>
            <select className="d-select" value={role} onChange={e => setRole(e.target.value as Role)}>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}{r === "master" ? "  ·  CENTER COURT demo" : ""}</option>
              ))}
            </select>
            <p style={{ fontFamily: sans, fontSize: 11, color: "rgba(185,156,255,0.58)", lineHeight: 1.55 }}>
              💡 데모에서는 master 포함 전체 역할 배정 가능.
              실제 /admin 패널에서는 master 변경이 CENTER COURT로 제한됩니다.
            </p>
            <div className="d-form-actions">
              <button type="button" className="d-btn-ghost d-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="d-btn-purple d-sm" onClick={handleAdd} disabled={saving || !name.trim() || !clubId}>Save</button>
            </div>
          </div>
        </div>
      )}

      {members.map(m => {
        const p = m.payload;
        const isEditing = editId === m.id;
        return (
          <div key={m.id} className={`d-card${isEditing ? " editing" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontFamily: serif, fontSize: 14, color: C.cream }}>{String(p.name ?? "")}</p>
                  <RoleBadge role={String(p.role ?? "member")} />
                </div>
                <p style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{String(p.club_name ?? "")}</p>
                {isEditing && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      className="d-select"
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as Role)}
                      style={{ maxWidth: 240 }}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}{r === "master" ? "  ·  CENTER COURT demo" : ""}</option>
                      ))}
                    </select>
                    <button type="button" className="d-btn-purple d-sm" onClick={() => handleRoleChange(m.id, editRole)}>Save</button>
                    <button type="button" className="d-btn-ghost d-sm" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="d-btn-ghost d-sm"
                    onClick={() => { setEditId(m.id); setEditRole((p.role as Role) ?? "member"); setShowForm(false); }}
                  >
                    Role
                  </button>
                  <button type="button" className="d-btn-danger" onClick={() => handleDelete(m.id)}>Delete</button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {members.length === 0 && !showForm && (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: serif, fontSize: 13, color: C.muted }}>No members yet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Matches panel ────────────────────────────────────────────────────────────

function MatchesPanel({ matches, clubs, onRefresh, onToast }: {
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
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!title.trim() || !clubId) return;
    setSaving(true);
    const club = clubs.find(c => c.id === clubId);
    await fetch("/api/demo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: "match",
        payload: {
          title: title.trim(), score: score.trim(), type,
          club_id: clubId,
          club_name: club ? String(club.payload.name) : "",
          status: "completed",
          played_at: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    setTitle(""); setScore(""); setType("doubles"); setClubId(""); setShowForm(false); setSaving(false);
    onToast("데모 데이터가 추가되었습니다. 실제 서비스에는 저장되지 않습니다.");
    onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/demo/entities/${id}`, { method: "DELETE" });
    onToast("데모 데이터가 삭제되었습니다.");
    onRefresh();
  }

  return (
    <div>
      <div className="d-section-hdr">
        <span className="d-section-label">{matches.length} Match{matches.length !== 1 ? "es" : ""}</span>
        <button
          type="button"
          className="d-btn-purple d-sm"
          onClick={() => setShowForm(!showForm)}
          disabled={clubs.length === 0}
        >
          {showForm ? "Cancel" : "Add Match"}
        </button>
      </div>

      {showForm && (
        <div className="d-form">
          <p style={{ fontFamily: serif, fontSize: 9, letterSpacing: "0.22em", color: C.purple, textTransform: "uppercase", marginBottom: 12 }}>
            New Match
          </p>
          <div className="d-form-row">
            <input className="d-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Match title *" autoFocus />
            <input className="d-input" value={score} onChange={e => setScore(e.target.value)} placeholder="Score  (e.g. 6-4, 7-5)" />
            <select className="d-select" value={clubId} onChange={e => setClubId(e.target.value)}>
              <option value="">Select club *</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{String(c.payload.name ?? c.id)}</option>)}
            </select>
            <select className="d-select" value={type} onChange={e => setType(e.target.value as "singles" | "doubles")}>
              <option value="doubles">Doubles</option>
              <option value="singles">Singles</option>
            </select>
            <div className="d-form-actions">
              <button type="button" className="d-btn-ghost d-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="d-btn-purple d-sm" onClick={handleAdd} disabled={saving || !title.trim() || !clubId}>Save</button>
            </div>
          </div>
        </div>
      )}

      {matches.map(m => {
        const p = m.payload;
        return (
          <div key={m.id} className="d-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontFamily: serif, fontSize: 14, color: C.cream }}>{String(p.title ?? "")}</p>
                  <span style={{
                    fontSize: 9, fontFamily: sans, fontWeight: 600, letterSpacing: "0.08em",
                    color: C.muted, border: `1px solid rgba(169,184,166,0.24)`,
                    borderRadius: 4, padding: "1px 6px",
                  }}>
                    {String(p.type ?? "doubles")}
                  </span>
                </div>
                {!!p.score && (
                  <p style={{ fontFamily: mono, fontSize: 13, color: C.green, marginBottom: 3 }}>{String(p.score)}</p>
                )}
                <p style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>
                  {String(p.club_name ?? "")} · {String(p.played_at ?? "").slice(0, 10)}
                </p>
              </div>
              <button type="button" className="d-btn-danger" onClick={() => handleDelete(m.id)}>Delete</button>
            </div>
          </div>
        );
      })}

      {matches.length === 0 && !showForm && (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: serif, fontSize: 13, color: C.muted }}>No matches recorded yet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Activity panel ───────────────────────────────────────────────────────────

function ActivityPanel({ activities }: { activities: DemoEntity[] }) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const accent: Record<string, string> = {
    club: C.purple, member: C.amber, match: C.green, session: C.muted,
  };

  return (
    <div>
      <div className="d-section-hdr">
        <span className="d-section-label">{sorted.length} Event{sorted.length !== 1 ? "s" : ""}</span>
      </div>
      {sorted.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <p style={{ fontFamily: serif, fontSize: 13, color: C.muted }}>No activity yet.</p>
        </div>
      ) : (
        <div className="d-activity-wrap">
          {sorted.map(a => {
            const p = a.payload;
            const ac = accent[String(p.entity_type ?? "")] ?? C.muted;
            return (
              <div key={a.id} className="d-activity-row">
                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: ac, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: sans, fontSize: 12, color: C.cream, marginBottom: 2 }}>{String(p.action ?? "")}</p>
                  {!!p.entity_name && (
                    <p style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{String(p.entity_name)}</p>
                  )}
                </div>
                <p style={{ fontFamily: mono, fontSize: 10, color: "rgba(169,184,166,0.38)", flexShrink: 0 }}>
                  {new Date(String(p.timestamp ?? a.created_at)).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "clubs",    label: "Clubs" },
  { key: "members",  label: "Members" },
  { key: "matches",  label: "Matches" },
  { key: "activity", label: "Activity" },
];

export default function DemoPageClient() {
  const [tab, setTab] = useState<Tab>("clubs");
  const [entities, setEntities] = useState<DemoEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const clubs      = entities.filter(e => e.entity_type === "club");
  const members    = entities.filter(e => e.entity_type === "member");
  const matches    = entities.filter(e => e.entity_type === "match");
  const activities = entities.filter(e => e.entity_type === "activity");

  const expiresAt = entities.length > 0
    ? entities.reduce((max, e) => e.expires_at > max ? e.expires_at : max, entities[0].expires_at)
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

  useEffect(() => { loadEntities(); }, [loadEntities]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  async function handleReset() {
    setResetting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    await loadEntities();
    setResetting(false);
    setTab("clubs");
    setToast("데모 데이터가 초기화되었습니다.");
  }

  const tabCount = (key: Tab) => {
    if (key === "clubs")    return clubs.length;
    if (key === "members")  return members.length;
    if (key === "matches")  return matches.length;
    return activities.length;
  };

  return (
    <>
      <DemoStyles />
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* ── Sticky header ── */}
      <header className="d-header">
        <div className="d-header-inner">
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: "linear-gradient(145deg, rgba(143,107,255,0.26) 0%, rgba(2,9,5,0.5) 100%)",
              border: `1px solid ${C.purpleBdr}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: serif, fontSize: 10, fontWeight: 700, color: C.cream }}>SM</span>
            </div>
            <div>
              <p style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, color: C.cream, lineHeight: 1.2 }}>Super Match</p>
              <p style={{ fontFamily: sans, fontSize: 8.5, letterSpacing: "0.18em", color: C.purple, textTransform: "uppercase" }}>
                Platform Demo
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SessionTimer expiresAt={expiresAt} />
            <PlatformHomeLink className="d-back-link">← Platform</PlatformHomeLink>
            <button
              type="button"
              className="d-btn-ghost d-sm"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "…" : "↺ Reset"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="d-main">

        {/* Hero */}
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${C.purple}`,
          borderRadius: "0 12px 12px 0",
          padding: "20px 24px",
          marginBottom: 12,
        }}>
          <p style={{
            fontFamily: serif, fontSize: 9, letterSpacing: "0.28em",
            textTransform: "uppercase", color: C.purple, marginBottom: 8,
          }}>
            Experience Mode
          </p>
          <h1 style={{
            fontFamily: serif,
            fontSize: "clamp(19px, 3vw, 26px)",
            fontWeight: 400, color: C.cream, lineHeight: 1.25, marginBottom: 6,
          }}>
            Explore Club Management.
            <br />
            <span style={{ color: C.muted }}>No login required.</span>
          </h1>
          <p style={{ fontFamily: sans, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Explore club, member, and match operations with fully isolated demo data.
          </p>
        </div>

        {/* Stats */}
        <div className="d-stats">
          <StatCard label="Clubs"      value={clubs.length}      accent={C.purple} />
          <StatCard label="Members"    value={members.length}    accent={C.amber}  />
          <StatCard label="Matches"    value={matches.length}    accent={C.green}  />
          <StatCard label="Activities" value={activities.length} />
        </div>

        {/* Policy notice */}
        <div className="d-policy">
          {[
            "실제 운영 DB에는 저장되지 않습니다",
            "이 세션에만 격리됩니다",
            "최대 1시간 후 자동 삭제됩니다",
          ].map((text, i) => (
            <div key={i} className="d-policy-item">
              <span style={{ color: "rgba(185,156,255,0.35)", fontSize: 14 }}>·</span>
              {text}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="d-tab-bar">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`d-tab-btn${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {tabCount(t.key) > 0 && (
                <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.55, fontFamily: mono }}>
                  {tabCount(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab panel */}
        {loading ? (
          <div style={{ padding: "52px 0", textAlign: "center" }}>
            <p style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>Loading…</p>
          </div>
        ) : (
          <>
            {tab === "clubs"    && <ClubsPanel clubs={clubs} onRefresh={loadEntities} onToast={showToast} />}
            {tab === "members"  && <MembersPanel members={members} clubs={clubs} onRefresh={loadEntities} onToast={showToast} />}
            {tab === "matches"  && <MatchesPanel matches={matches} clubs={clubs} onRefresh={loadEntities} onToast={showToast} />}
            {tab === "activity" && <ActivityPanel activities={activities} />}
          </>
        )}
      </main>
    </>
  );
}
