"use client";

import { useState, useCallback } from "react";
import type { ClubRow } from "./page";

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
};

/* ── types ──────────────────────────────────────────────── */
interface Props {
  clubs: ClubRow[];
  isOwner: boolean;
}

type EditTarget = ClubRow | null;

/* ── helpers ─────────────────────────────────────────────── */
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ── component ────────────────────────────────────────────── */
export function ClubRegistryPageClient({ clubs: initial, isOwner }: Props) {
  const [clubs, setClubs] = useState<ClubRow[]>(initial);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy,  setBusy]    = useState(false);

  /* create form */
  const [showCreate, setShowCreate] = useState(false);
  const [cName,  setCName]  = useState("");
  const [cSlug,  setCSlug]  = useState("");
  const [cDesc,  setCDesc]  = useState("");

  /* edit modal */
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [eName,  setEName]  = useState("");
  const [eSlug,  setESlug]  = useState("");
  const [eDesc,  setEDesc]  = useState("");
  const [eStatus, setEStatus] = useState("active");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  const reload = useCallback(async () => {
    const res = await fetch("/api/platform/clubs");
    if (res.ok) {
      const json = await res.json();
      setClubs(json.clubs ?? []);
    }
  }, []);

  /* ── CREATE ─────────────────────────────────────────────── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName, slug: cSlug, description: cDesc || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(errorMsg(json.error), false);
        return;
      }
      showToast("클럽이 생성되었습니다.");
      setCName(""); setCSlug(""); setCDesc("");
      setShowCreate(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  /* ── EDIT open ───────────────────────────────────────────── */
  function openEdit(club: ClubRow) {
    setEditTarget(club);
    setEName(club.name);
    setESlug(club.slug);
    setEDesc(club.description ?? "");
    setEStatus(club.status);
  }

  /* ── PATCH ────────────────────────────────────────────────── */
  async function handlePatch(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/clubs/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eName,
          slug: eSlug,
          description: eDesc || null,
          status: eStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(errorMsg(json.error), false);
        return;
      }
      showToast("클럽 정보가 수정되었습니다.");
      setEditTarget(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  /* ── quick status toggle ────────────────────────────────── */
  async function toggleStatus(club: ClubRow) {
    if (!isOwner || busy) return;
    const next = club.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) { showToast("상태 변경 실패", false); return; }
      showToast(next === "active" ? "클럽을 활성화했습니다." : "클럽을 비활성화했습니다.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const active   = clubs.filter(c => c.status === "active");
  const inactive = clubs.filter(c => c.status !== "active");

  return (
    <>
      <style>{`
        .cr-input {
          width: 100%;
          background: rgba(4,10,6,0.85);
          border: 1px solid rgba(245,240,232,0.14);
          border-radius: 7px;
          color: #f0ebe0;
          font-size: 12px;
          padding: 8px 11px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .cr-input:focus { border-color: rgba(139,92,246,0.55); }
        .cr-btn-primary {
          padding: 7px 16px; border-radius: 7px; font-size: 10.5px;
          font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          background: rgba(109,40,217,0.40); border: 1px solid rgba(139,92,246,0.55);
          color: #c4b5fd; cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .cr-btn-primary:hover:not(:disabled) {
          background: rgba(109,40,217,0.58); border-color: rgba(139,92,246,0.75);
        }
        .cr-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .cr-btn-ghost {
          padding: 5px 12px; border-radius: 6px; font-size: 9.5px;
          font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
          background: transparent; border: 1px solid rgba(245,240,232,0.14);
          color: rgba(245,240,232,0.45); cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .cr-btn-ghost:hover:not(:disabled) {
          background: rgba(245,240,232,0.06); color: #f0ebe0;
        }
        .cr-btn-ghost:disabled { opacity: 0.35; cursor: not-allowed; }
        .cr-row { transition: background 0.12s; }
        .cr-row:hover { background: rgba(245,240,232,0.03); }
        .cr-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,6,3,0.72); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        @media (prefers-reduced-motion: reduce) {
          .cr-btn-primary, .cr-btn-ghost, .cr-row { transition: none !important; }
        }
      `}</style>

      {/* ── toast ─────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: toast.ok ? "rgba(20,50,30,0.96)" : "rgba(50,10,10,0.96)",
          border: `1px solid ${toast.ok ? "rgba(134,239,172,0.3)" : "rgba(252,165,165,0.3)"}`,
          borderRadius: 9, padding: "9px 20px",
          color: toast.ok ? C.green : C.red, fontSize: 12, fontWeight: 600,
          boxShadow: "0 6px 24px rgba(0,0,0,0.7)",
          whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── edit modal ────────────────────────────────────────── */}
      {editTarget && (
        <div className="cr-overlay" onClick={() => setEditTarget(null)}>
          <div
            style={{
              background: "rgba(3,9,5,0.97)", border: `1px solid ${C.purpleBdr}`,
              borderRadius: 14, padding: "22px 24px", width: "100%", maxWidth: 420,
              boxShadow: "0 12px 48px rgba(0,0,0,0.85)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
              Edit Club
            </p>
            <form onSubmit={handlePatch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle}>Club Name</label>
                <input className="cr-input" value={eName} onChange={e => setEName(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input className="cr-input" value={eSlug}
                  onChange={e => setESlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                <p style={{ color: C.dim, fontSize: 9, marginTop: 3 }}>/c/{eSlug || "…"}</p>
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <textarea className="cr-input" rows={2} value={eDesc} onChange={e => setEDesc(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select className="cr-input" value={eStatus} onChange={e => setEStatus(e.target.value)}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="cr-btn-ghost" onClick={() => setEditTarget(null)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="cr-btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── page header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 26 }}>
        <p style={scoreboardLabel}>Club Registry</p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{
            color: C.cream, fontSize: 26, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.15,
          }}>
            Club Registry
          </h1>
          {isOwner && (
            <button
              className="cr-btn-primary"
              onClick={() => { setShowCreate(v => !v); setCName(""); setCSlug(""); setCDesc(""); }}
            >
              {showCreate ? "Cancel" : "+ Create Club"}
            </button>
          )}
        </div>
      </div>

      {/* ── stat cards ───────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22 }}>
        <StatCard label="Total Clubs" value={clubs.length} />
        <StatCard label="Active"      value={active.length}   accent />
        <StatCard label="Inactive"    value={inactive.length} dim />
      </div>

      {/* ── create form ─────────────────────────────────────── */}
      {isOwner && showCreate && (
        <div style={{
          borderRadius: 13, border: `1px solid ${C.purpleBdr}`,
          background: "rgba(3,9,5,0.94)", padding: "18px 20px",
          marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}>
          <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
            New Club
          </p>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Club Name *</label>
                <input
                  className="cr-input"
                  placeholder="청우 테니스"
                  value={cName}
                  onChange={e => {
                    setCName(e.target.value);
                    if (!cSlug || cSlug === slugify(cName)) setCSlug(slugify(e.target.value));
                  }}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Slug *</label>
                <input
                  className="cr-input"
                  placeholder="cheongwoo-tennis"
                  value={cSlug}
                  onChange={e => setCSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
                <p style={{ color: C.dim, fontSize: 9, marginTop: 3 }}>/c/{cSlug || "…"}</p>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <input className="cr-input" placeholder="클럽 소개" value={cDesc} onChange={e => setCDesc(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
              <button type="button" className="cr-btn-ghost" onClick={() => setShowCreate(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="cr-btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create Club"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── club list ────────────────────────────────────────── */}
      {clubs.length === 0 ? (
        <CourtPanel>
          <p style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: "28px 16px" }}>
            등록된 클럽이 없습니다.
          </p>
        </CourtPanel>
      ) : (
        <CourtPanel>
          {clubs.map((club, idx) => (
            <div
              key={club.id}
              className="cr-row"
              style={{
                padding: "13px 18px",
                borderBottom: idx < clubs.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 12,
              }}
            >
              {/* info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ color: "#f0ebe0", fontSize: 13, fontWeight: 600 }}>
                    {club.name}
                  </span>
                  <StatusPill status={club.status} />
                </div>
                {club.description && (
                  <p style={{ color: C.muted, fontSize: 10.5, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                    {club.description}
                  </p>
                )}
                <p style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  /c/{club.slug}
                </p>
              </div>

              {/* actions */}
              {isOwner && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="cr-btn-ghost" onClick={() => openEdit(club)} disabled={busy}>
                    Edit
                  </button>
                  <button
                    className="cr-btn-ghost"
                    onClick={() => toggleStatus(club)}
                    disabled={busy}
                    style={{
                      color: club.status === "active" ? "rgba(252,165,165,0.7)" : "rgba(134,239,172,0.7)",
                      borderColor: club.status === "active" ? "rgba(252,165,165,0.2)" : "rgba(134,239,172,0.2)",
                    }}
                  >
                    {club.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </CourtPanel>
      )}

      {!isOwner && (
        <p style={{ color: C.dim, fontSize: 10, marginTop: 14, textAlign: "right", letterSpacing: "0.04em" }}>
          클럽 생성·수정은 owner 계정만 가능합니다.
        </p>
      )}
    </>
  );
}

/* ── sub-components ─────────────────────────────────────── */

function CourtPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 13, border: "1px solid rgba(245,240,232,0.12)",
      background: "rgba(2,6,4,0.90)", overflow: "hidden",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, accent, dim }: { label: string; value: number; accent?: boolean; dim?: boolean }) {
  const valueColor = accent ? "#b197fc" : dim ? "rgba(245,240,232,0.4)" : "#f5f0e8";
  const borderColor = accent ? "rgba(139,92,246,0.40)" : "rgba(245,240,232,0.10)";
  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${borderColor}`,
      background: "rgba(2,6,4,0.88)", backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)", padding: "13px 14px",
      boxShadow: accent ? "0 0 18px rgba(109,40,217,0.2)" : "0 4px 20px rgba(0,0,0,0.55)",
    }}>
      <p style={{ color: valueColor, fontSize: 34, fontWeight: 700, lineHeight: 1, marginBottom: 5, fontFamily: "Georgia, serif", letterSpacing: "-0.02em" }}>
        {value}
      </p>
      <p style={{ color: "rgba(245,240,232,0.38)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
      padding: "1px 6px", borderRadius: 3,
      background: active ? "rgba(134,239,172,0.10)" : "rgba(245,240,232,0.05)",
      border: `1px solid ${active ? "rgba(134,239,172,0.22)" : "rgba(245,240,232,0.09)"}`,
      color: active ? "#86efac" : "rgba(245,240,232,0.28)",
      flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

/* ── style constants ─────────────────────────────────────── */
const scoreboardLabel: React.CSSProperties = {
  color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700,
  letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 6,
  fontFamily: "Georgia, serif",
};

const labelStyle: React.CSSProperties = {
  display: "block", color: "rgba(245,240,232,0.38)", fontSize: 9.5,
  fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase",
  marginBottom: 5,
};

/* ── error message map ───────────────────────────────────── */
function errorMsg(code: string): string {
  const map: Record<string, string> = {
    name_required:    "클럽 이름을 입력해주세요.",
    slug_required:    "Slug를 입력해주세요.",
    slug_invalid:     "Slug는 소문자·숫자·하이픈만 사용 가능합니다.",
    slug_reserved:    "예약된 Slug입니다. 다른 이름을 사용해주세요.",
    slug_taken:       "이미 사용 중인 Slug입니다.",
    status_invalid:   "올바르지 않은 상태값입니다.",
    nothing_to_update:"변경된 내용이 없습니다.",
    forbidden:        "Owner 권한이 필요합니다.",
    db_error:         "데이터베이스 오류가 발생했습니다.",
  };
  return map[code] ?? "알 수 없는 오류가 발생했습니다.";
}
