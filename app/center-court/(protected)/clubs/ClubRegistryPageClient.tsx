"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
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
  amber:     "#fcd34d",
};

/* ── types ──────────────────────────────────────────────── */
interface Props {
  clubs: ClubRow[];
  isOwner: boolean;
}

type EditTarget = ClubRow | null;

export interface OperatorMember {
  id: string;
  name: string;
  nickname: string;
  phone: string | null;
  permission_role: string;
  auth_user_id: string | null;
  kakao_provider_id: string | null;
  is_active: boolean;
  is_dormant: boolean;
  deleted_at: string | null;
  club_id: string;
}

interface OperatorsData {
  club: { id: string; name: string; slug: string };
  members: OperatorMember[];
  roleCounts: { master: number; admin: number; manager: number; member: number };
}

const OPERATOR_ROLES = new Set(["master", "admin", "manager"]);
const ROLE_ORDER: Record<string, number> = { master: 0, admin: 1, manager: 2, scorer: 3, member: 4 };

/* ── helpers ─────────────────────────────────────────────── */
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function roleSortKey(role: string) {
  return ROLE_ORDER[role] ?? 99;
}

/* ════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════ */
export function ClubRegistryPageClient({ clubs: initial, isOwner }: Props) {
  const [clubs, setClubs]   = useState<ClubRow[]>(initial);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy,  setBusy]    = useState(false);

  /* create form */
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cDesc, setCDesc] = useState("");

  /* edit modal */
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [eName,   setEName]   = useState("");
  const [eSlug,   setESlug]   = useState("");
  const [eDesc,   setEDesc]   = useState("");
  const [eStatus, setEStatus] = useState("active");

  /* operators modal */
  const [opsClub, setOpsClub]   = useState<ClubRow | null>(null);
  const [opsData, setOpsData]   = useState<OperatorsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  const reloadClubs = useCallback(async () => {
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
      if (!res.ok) { showToast(errorMsg(json.error), false); return; }
      showToast("클럽이 생성되었습니다.");
      setCName(""); setCSlug(""); setCDesc("");
      setShowCreate(false);
      await reloadClubs();
    } finally { setBusy(false); }
  }

  /* ── EDIT open ───────────────────────────────────────────── */
  function openEdit(club: ClubRow) {
    setEditTarget(club);
    setEName(club.name); setESlug(club.slug);
    setEDesc(club.description ?? ""); setEStatus(club.status);
  }

  /* ── PATCH club ──────────────────────────────────────────── */
  async function handlePatch(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/clubs/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: eName, slug: eSlug, description: eDesc || null, status: eStatus }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(errorMsg(json.error), false); return; }
      showToast("클럽 정보가 수정되었습니다.");
      setEditTarget(null);
      await reloadClubs();
    } finally { setBusy(false); }
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
      await reloadClubs();
    } finally { setBusy(false); }
  }

  /* ── OPERATORS open ─────────────────────────────────────── */
  async function openOperators(club: ClubRow) {
    setOpsClub(club);
    setOpsData(null);
    setOpsLoading(true);
    try {
      const res = await fetch(`/api/platform/clubs/${club.id}/operators`);
      if (res.ok) {
        const json = await res.json();
        setOpsData(json);
      } else {
        showToast("운영자 목록을 불러오지 못했습니다.", false);
        setOpsClub(null);
      }
    } finally { setOpsLoading(false); }
  }

  /* ── OPERATORS reload ───────────────────────────────────── */
  const reloadOps = useCallback(async (clubId: string) => {
    const res = await fetch(`/api/platform/clubs/${clubId}/operators`);
    if (res.ok) setOpsData(await res.json());
  }, []);

  /* ── ROLE CHANGE ────────────────────────────────────────── */
  async function changeRole(clubId: string, memberId: string, role: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/clubs/${clubId}/operators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(operatorErrorMsg(json.error), false); return; }
      showToast("운영자 권한이 변경되었습니다.");
      await reloadOps(clubId);
    } finally { setBusy(false); }
  }

  const active   = clubs.filter(c => c.status === "active");
  const inactive = clubs.filter(c => c.status !== "active");

  return (
    <>
      <GlobalStyles />

      {/* ── toast ─────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 300, background: toast.ok ? "rgba(20,50,30,0.97)" : "rgba(50,10,10,0.97)",
          border: `1px solid ${toast.ok ? "rgba(134,239,172,0.3)" : "rgba(252,165,165,0.3)"}`,
          borderRadius: 9, padding: "9px 20px",
          color: toast.ok ? C.green : C.red, fontSize: 12, fontWeight: 600,
          boxShadow: "0 6px 24px rgba(0,0,0,0.7)", whiteSpace: "nowrap",
          maxWidth: "90vw", textAlign: "center",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── edit club modal ───────────────────────────────── */}
      {editTarget && (
        <Overlay onClose={() => setEditTarget(null)}>
          <ModalBox title="Edit Club" onClose={() => setEditTarget(null)}>
            <form onSubmit={handlePatch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FormField label="Club Name">
                <input className="cr-input" value={eName} onChange={e => setEName(e.target.value)} required />
              </FormField>
              <FormField label="Slug">
                <input className="cr-input" value={eSlug}
                  onChange={e => setESlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                <p style={{ color: C.dim, fontSize: 9, marginTop: 3 }}>/c/{eSlug || "…"}</p>
              </FormField>
              <FormField label="Description (optional)">
                <textarea className="cr-input" rows={2} value={eDesc}
                  onChange={e => setEDesc(e.target.value)} style={{ resize: "vertical" }} />
              </FormField>
              <FormField label="Status">
                <select className="cr-input" value={eStatus} onChange={e => setEStatus(e.target.value)}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </FormField>
              <ModalFooter>
                <button type="button" className="cr-btn-ghost" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="cr-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
              </ModalFooter>
            </form>
          </ModalBox>
        </Overlay>
      )}

      {/* ── operators modal ───────────────────────────────── */}
      {opsClub && (
        <OperatorsModal
          club={opsClub}
          data={opsData}
          loading={opsLoading}
          busy={busy}
          isOwner={isOwner}
          onClose={() => { setOpsClub(null); setOpsData(null); }}
          onChangeRole={changeRole}
        />
      )}

      {/* ── page header ──────────────────────────────────── */}
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
            <button className="cr-btn-primary"
              onClick={() => { setShowCreate(v => !v); setCName(""); setCSlug(""); setCDesc(""); }}>
              {showCreate ? "Cancel" : "+ Create Club"}
            </button>
          )}
        </div>
      </div>

      {/* ── stat cards ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22 }}>
        <StatCard label="Total Clubs" value={clubs.length} />
        <StatCard label="Active"      value={active.length} accent />
        <StatCard label="Inactive"    value={inactive.length} dim />
      </div>

      {/* ── create form ────────────────────────────────── */}
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
              <FormField label="Club Name *">
                <input className="cr-input" placeholder="청우 테니스" value={cName}
                  onChange={e => {
                    setCName(e.target.value);
                    if (!cSlug || cSlug === slugify(cName)) setCSlug(slugify(e.target.value));
                  }} required />
              </FormField>
              <FormField label="Slug *">
                <input className="cr-input" placeholder="cheongwoo-tennis" value={cSlug}
                  onChange={e => setCSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                <p style={{ color: C.dim, fontSize: 9, marginTop: 3 }}>/c/{cSlug || "…"}</p>
              </FormField>
            </div>
            <FormField label="Description (optional)">
              <input className="cr-input" placeholder="클럽 소개" value={cDesc} onChange={e => setCDesc(e.target.value)} />
            </FormField>
            <ModalFooter>
              <button type="button" className="cr-btn-ghost" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="cr-btn-primary" disabled={busy}>{busy ? "Creating…" : "Create Club"}</button>
            </ModalFooter>
          </form>
        </div>
      )}

      {/* ── club list ───────────────────────────────────── */}
      {clubs.length === 0 ? (
        <CourtPanel>
          <p style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: "28px 16px" }}>
            등록된 클럽이 없습니다.
          </p>
        </CourtPanel>
      ) : (
        <CourtPanel>
          {clubs.map((club, idx) => (
            <div key={club.id} className="cr-row" style={{
              padding: "13px 18px",
              borderBottom: idx < clubs.length - 1 ? `1px solid ${C.border}` : "none",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ color: "#f0ebe0", fontSize: 13, fontWeight: 600 }}>{club.name}</span>
                  <StatusPill status={club.status} />
                </div>
                {club.description && (
                  <p style={{ color: C.muted, fontSize: 10.5, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                    {club.description}
                  </p>
                )}
                <p style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  /c/{club.slug}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Link
                  href={`/center-court/clubs/${club.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <button className="cr-btn-ghost" style={{ color: "rgba(196,181,253,0.7)", borderColor: "rgba(139,92,246,0.25)" }}>
                    Detail
                  </button>
                </Link>
                <button className="cr-btn-ops" onClick={() => openOperators(club)} disabled={busy}>
                  Operators
                </button>
                {isOwner && (
                  <>
                    <button className="cr-btn-ghost" onClick={() => openEdit(club)} disabled={busy}>Edit</button>
                    <button className="cr-btn-ghost" onClick={() => toggleStatus(club)} disabled={busy}
                      style={{
                        color: club.status === "active" ? "rgba(252,165,165,0.7)" : "rgba(134,239,172,0.7)",
                        borderColor: club.status === "active" ? "rgba(252,165,165,0.2)" : "rgba(134,239,172,0.2)",
                      }}>
                      {club.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </>
                )}
              </div>
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

/* ════════════════════════════════════════════════════════
   Operators Modal
   ════════════════════════════════════════════════════════ */
function OperatorsModal({
  club, data, loading, busy, isOwner, onClose, onChangeRole,
}: {
  club: ClubRow;
  data: OperatorsData | null;
  loading: boolean;
  busy: boolean;
  isOwner: boolean;
  onClose: () => void;
  onChangeRole: (clubId: string, memberId: string, role: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<"all" | "operators" | "master" | "admin" | "manager" | "unlinked">("all");
  const [search, setSearch] = useState("");
  const [confirmOp, setConfirmOp] = useState<{ member: OperatorMember; role: string } | null>(null);

  const members = data?.members ?? [];
  const counts  = data?.roleCounts;

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      m.nickname.toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q) ||
      m.permission_role.includes(q);

    const matchFilter = (() => {
      switch (filter) {
        case "operators": return OPERATOR_ROLES.has(m.permission_role);
        case "master":   return m.permission_role === "master";
        case "admin":    return m.permission_role === "admin";
        case "manager":  return m.permission_role === "manager";
        case "unlinked": return !m.auth_user_id;
        default:         return true;
      }
    })();

    return matchSearch && matchFilter;
  });

  function canChangeToOperator(m: OperatorMember) {
    return m.is_active && !!m.auth_user_id;
  }

  async function handleChangeRole(m: OperatorMember, role: string) {
    setConfirmOp(null);
    await onChangeRole(club.id, m.id, role);
  }

  return (
    <Overlay onClose={onClose} zIndex={200}>
      <div style={{
        background: "rgba(3,9,5,0.99)", border: `1px solid ${C.purpleBdr}`,
        borderRadius: 16, width: "100%", maxWidth: 700,
        maxHeight: "88dvh", display: "flex", flexDirection: "column",
        boxShadow: "0 16px 64px rgba(0,0,0,0.9)",
      }} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{
          padding: "16px 20px 14px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          flexShrink: 0,
        }}>
          <div>
            <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>
              Club Operators
            </p>
            <p style={{ color: C.cream, fontSize: 15, fontWeight: 700, letterSpacing: "0.04em" }}>
              {club.name}
            </p>
            <p style={{ color: C.dim, fontSize: 9, marginTop: 2 }}>/c/{club.slug}</p>
          </div>
          <button className="cr-btn-ghost" onClick={onClose} style={{ flexShrink: 0, marginTop: 2 }}>✕</button>
        </div>

        {/* master policy notice */}
        <div style={{
          padding: "8px 20px", background: "rgba(109,40,217,0.10)",
          borderBottom: `1px solid rgba(139,92,246,0.18)`, flexShrink: 0,
        }}>
          <p style={{ color: "rgba(196,181,253,0.65)", fontSize: 9.5, lineHeight: 1.5 }}>
            CENTER COURT에서만 master 권한을 관리할 수 있습니다. Master 권한은 클럽 최고 운영 권한입니다. 복수 master 허용.
          </p>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Spinner />
          </div>
        ) : (
          <>
            {/* role count summary */}
            {counts && (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8, padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
                flexShrink: 0,
              }}>
                {([
                  { label: "Master",  value: counts.master,  color: C.purple },
                  { label: "Admin",   value: counts.admin,   color: C.amber },
                  { label: "Manager", value: counts.manager, color: C.green },
                  { label: "Member",  value: counts.member,  color: C.muted },
                ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "rgba(245,240,232,0.04)", borderRadius: 8,
                    padding: "7px 10px", textAlign: "center",
                  }}>
                    <p style={{ color, fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</p>
                    <p style={{ color: C.dim, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* search + filter */}
            <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <input
                className="cr-input"
                placeholder="이름 / 닉네임 / 전화번호 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {(["all", "operators", "master", "admin", "manager", "unlinked"] as const).map(f => (
                  <button key={f} className="cr-filter-btn"
                    data-active={filter === f ? "1" : undefined}
                    onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : f === "operators" ? "Operators" : f === "unlinked" ? "Unlinked" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* member list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filtered.length === 0 ? (
                <p style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: "28px 16px" }}>
                  해당 조건의 회원이 없습니다.
                </p>
              ) : (
                filtered.map((m, idx) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isLast={idx === filtered.length - 1}
                    isOwner={isOwner}
                    busy={busy}
                    canChangeToOperator={canChangeToOperator(m)}
                    masterCount={counts?.master ?? 0}
                    onChangeRole={(role) => {
                      if (role === "master") {
                        setConfirmOp({ member: m, role });
                      } else {
                        handleChangeRole(m, role);
                      }
                    }}
                  />
                ))
              )}
            </div>

            {/* master confirm */}
            {confirmOp && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                background: "rgba(0,4,2,0.82)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
                borderRadius: 16,
              }}>
                <div style={{
                  background: "rgba(5,12,7,0.99)", border: `1px solid ${C.purpleBdr}`,
                  borderRadius: 12, padding: "20px 24px", maxWidth: 340,
                }}>
                  <p style={{ color: C.amber, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>
                    Promote to Master
                  </p>
                  <p style={{ color: C.cream, fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
                    <strong>{confirmOp.member.name}</strong> 님에게 Master 권한을 부여합니다.<br />
                    Master 권한은 클럽 최고 운영 권한입니다. 계속하시겠습니까?
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="cr-btn-ghost" onClick={() => setConfirmOp(null)} disabled={busy}>Cancel</button>
                    <button className="cr-btn-primary" onClick={() => handleChangeRole(confirmOp.member, confirmOp.role)} disabled={busy}>
                      {busy ? "…" : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

/* ── MemberRow ─────────────────────────────────────────── */
function MemberRow({
  member, isLast, isOwner, busy, canChangeToOperator, masterCount, onChangeRole,
}: {
  member: OperatorMember;
  isLast: boolean;
  isOwner: boolean;
  busy: boolean;
  canChangeToOperator: boolean;
  masterCount: number;
  onChangeRole: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const role = member.permission_role;
  const isLastMaster = role === "master" && masterCount <= 1;
  const isActive     = member.is_active;
  const isLinked     = !!member.auth_user_id;

  const roleOptions = [
    { value: "master",  label: "Promote to Master",  color: C.purple, disabled: !canChangeToOperator },
    { value: "admin",   label: "Set Admin",           color: C.amber,  disabled: !canChangeToOperator },
    { value: "manager", label: "Set Manager",         color: C.green,  disabled: !canChangeToOperator },
    { value: "member",  label: "Set Member",          color: C.muted,  disabled: isLastMaster },
  ].filter(o => o.value !== role);

  return (
    <div style={{
      padding: "11px 20px",
      borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* role indicator dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: role === "master" ? C.purple : role === "admin" ? C.amber : role === "manager" ? C.green : "rgba(245,240,232,0.18)",
      }} />

      {/* info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ color: "#f0ebe0", fontSize: 12, fontWeight: 600 }}>{member.name}</span>
          {member.nickname && member.nickname !== member.name && (
            <span style={{ color: C.muted, fontSize: 10 }}>({member.nickname})</span>
          )}
          <RoleBadge role={role} />
          {!isActive && <span style={{ fontSize: 8, background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.2)", color: C.red, borderRadius: 3, padding: "1px 5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>inactive</span>}
          {member.is_dormant && <span style={{ fontSize: 8, background: "rgba(245,240,232,0.05)", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 3, padding: "1px 5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>dormant</span>}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
          {member.phone && <span style={{ color: C.dim, fontSize: 9.5 }}>{member.phone}</span>}
          <span style={{ fontSize: 9, color: isLinked ? "rgba(134,239,172,0.6)" : "rgba(252,165,165,0.5)", fontWeight: 600 }}>
            {isLinked ? "✓ Linked" : "✗ Unlinked"}
          </span>
        </div>
      </div>

      {/* change role dropdown */}
      {isOwner && roleOptions.length > 0 && (
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
          <button className="cr-btn-ghost" onClick={() => setOpen(v => !v)} disabled={busy}
            style={{ fontSize: 9, padding: "4px 10px" }}>
            Change Role ▾
          </button>
          {open && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
              background: "rgba(4,12,6,0.98)", border: `1px solid ${C.border}`,
              borderRadius: 8, overflow: "hidden", minWidth: 160,
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
            }}>
              {roleOptions.map(opt => (
                <button key={opt.value}
                  disabled={opt.disabled || busy}
                  onClick={() => { setOpen(false); onChangeRole(opt.value); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 14px", background: "transparent", border: "none",
                    color: opt.disabled ? "rgba(245,240,232,0.18)" : opt.color,
                    fontSize: 11, fontWeight: 600, cursor: opt.disabled ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (!opt.disabled) (e.target as HTMLElement).style.background = "rgba(245,240,232,0.05)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  {opt.label}
                  {opt.value !== "member" && !canChangeToOperator && (
                    <span style={{ display: "block", fontSize: 8.5, color: "rgba(245,240,232,0.22)", marginTop: 1, fontWeight: 400 }}>
                      {!isActive ? "inactive 회원" : "카카오 계정 미연결"}
                    </span>
                  )}
                  {opt.value === "member" && isLastMaster && (
                    <span style={{ display: "block", fontSize: 8.5, color: "rgba(245,240,232,0.22)", marginTop: 1, fontWeight: 400 }}>
                      마지막 master
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Shared sub-components
   ════════════════════════════════════════════════════════ */

function Overlay({ children, onClose, zIndex = 100 }: { children: React.ReactNode; onClose: () => void; zIndex?: number }) {
  return (
    <div className="cr-overlay" style={{ zIndex }} onClick={onClose}>
      {children}
    </div>
  );
}

function ModalBox({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      background: "rgba(3,9,5,0.97)", border: `1px solid ${C.purpleBdr}`,
      borderRadius: 14, padding: "22px 24px", width: "100%", maxWidth: 420,
      boxShadow: "0 12px 48px rgba(0,0,0,0.85)", position: "relative",
    }} onClick={e => e.stopPropagation()}>
      <p style={{ color: C.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

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
      color: active ? "#86efac" : "rgba(245,240,232,0.28)", flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    master:  { bg: "rgba(196,181,253,0.15)", border: "rgba(196,181,253,0.35)", text: C.purple },
    admin:   { bg: "rgba(252,211,77,0.12)",  border: "rgba(252,211,77,0.28)",  text: C.amber },
    manager: { bg: "rgba(134,239,172,0.10)", border: "rgba(134,239,172,0.22)", text: C.green },
    scorer:  { bg: "rgba(245,240,232,0.06)", border: "rgba(245,240,232,0.12)", text: C.muted },
    member:  { bg: "rgba(245,240,232,0.04)", border: "rgba(245,240,232,0.08)", text: C.dim },
  };
  const c = colors[role] ?? colors.member;
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "1px 6px", borderRadius: 3,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text, flexShrink: 0,
    }}>
      {role}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      border: "2px solid rgba(196,181,253,0.20)",
      borderTopColor: C.purple,
      animation: "cr-spin 0.75s linear infinite",
    }} />
  );
}

/* ── global styles ──────────────────────────────────────── */
function GlobalStyles() {
  return (
    <style>{`
      @keyframes cr-spin { to { transform: rotate(360deg); } }
      .cr-input {
        width: 100%; background: rgba(4,10,6,0.85);
        border: 1px solid rgba(245,240,232,0.14); border-radius: 7px;
        color: #f0ebe0; font-size: 12px; padding: 8px 11px;
        outline: none; box-sizing: border-box; transition: border-color 0.15s;
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
      .cr-btn-ops {
        padding: 5px 12px; border-radius: 6px; font-size: 9.5px;
        font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
        background: rgba(109,40,217,0.14); border: 1px solid rgba(139,92,246,0.30);
        color: rgba(196,181,253,0.75); cursor: pointer; transition: background 0.15s, border-color 0.15s;
      }
      .cr-btn-ops:hover:not(:disabled) {
        background: rgba(109,40,217,0.25); border-color: rgba(139,92,246,0.50);
        color: #c4b5fd;
      }
      .cr-btn-ops:disabled { opacity: 0.35; cursor: not-allowed; }
      .cr-filter-btn {
        padding: 3px 10px; border-radius: 5px; font-size: 9px;
        font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
        background: transparent; border: 1px solid rgba(245,240,232,0.12);
        color: rgba(245,240,232,0.38); cursor: pointer; transition: all 0.12s;
      }
      .cr-filter-btn:hover { background: rgba(245,240,232,0.05); color: #f0ebe0; }
      .cr-filter-btn[data-active] {
        background: rgba(109,40,217,0.22); border-color: rgba(139,92,246,0.45);
        color: #c4b5fd;
      }
      .cr-row { transition: background 0.12s; }
      .cr-row:hover { background: rgba(245,240,232,0.03); }
      .cr-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,6,3,0.72); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      @media (prefers-reduced-motion: reduce) {
        .cr-btn-primary, .cr-btn-ghost, .cr-btn-ops, .cr-row { transition: none !important; }
        @keyframes cr-spin { to { transform: none; } }
      }
    `}</style>
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
  fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 5,
};

/* ── error messages ─────────────────────────────────────── */
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

function operatorErrorMsg(code: string): string {
  const map: Record<string, string> = {
    last_master:     "마지막 master는 해제할 수 없습니다.",
    inactive_member: "비활성 회원에게는 운영자 권한을 부여할 수 없습니다.",
    unlinked_member: "카카오 계정이 연결되지 않은 회원은 운영자 권한을 받을 수 없습니다.",
    club_mismatch:   "다른 클럽의 회원입니다.",
    member_deleted:  "탈퇴한 회원입니다.",
    role_invalid:    "올바르지 않은 권한값입니다.",
    member_not_found:"회원을 찾을 수 없습니다.",
    forbidden:       "Owner 권한이 필요합니다.",
    db_error:        "데이터베이스 오류가 발생했습니다.",
  };
  return map[code] ?? "알 수 없는 오류가 발생했습니다.";
}
