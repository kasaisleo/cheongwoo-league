"use client";

import { useState, useCallback } from "react";
import type { AuditLogRow } from "./page";

/* ── design tokens ─────────────────────────────────────── */
const C = {
  cream:     "#f5f0e8",
  muted:     "rgba(245,240,232,0.38)",
  dim:       "rgba(245,240,232,0.22)",
  border:    "rgba(245,240,232,0.10)",
  purple:    "#c4b5fd",
  purpleBg:  "rgba(109,40,217,0.22)",
  purpleBdr: "rgba(139,92,246,0.45)",
  green:     "#86efac",
  amber:     "#fcd34d",
  red:       "#fca5a5",
  sky:       "#7dd3fc",
};

/* ── action config ─────────────────────────────────────── */
type ActionConfig = { label: string; color: string; bg: string; border: string };

const ACTION_MAP: Record<string, ActionConfig> = {
  "club.create":               { label: "Club Created",       color: C.green,  bg: "rgba(134,239,172,0.10)", border: "rgba(134,239,172,0.25)" },
  "club.update":               { label: "Club Updated",       color: C.amber,  bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.25)"  },
  "club.status_change":        { label: "Status Changed",     color: C.amber,  bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.25)"  },
  "club.operator_role_change": { label: "Role Changed",       color: C.purple, bg: "rgba(196,181,253,0.10)", border: "rgba(196,181,253,0.25)" },
  "platform_admin.create":     { label: "Admin Created",      color: C.sky,    bg: "rgba(125,211,252,0.10)", border: "rgba(125,211,252,0.25)" },
  "platform_admin.update":     { label: "Admin Updated",      color: C.sky,    bg: "rgba(125,211,252,0.10)", border: "rgba(125,211,252,0.25)" },
  "platform_admin.password_reset": { label: "Password Reset", color: C.red,    bg: "rgba(252,165,165,0.10)", border: "rgba(252,165,165,0.25)" },
  "platform_admin.status_change":  { label: "Admin Status",   color: C.amber,  bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.25)"  },
};

function actionConfig(action: string): ActionConfig {
  return ACTION_MAP[action] ?? {
    label:  action,
    color:  C.muted,
    bg:     "rgba(245,240,232,0.05)",
    border: "rgba(245,240,232,0.12)",
  };
}

const ALL_ACTIONS = Object.keys(ACTION_MAP);

/* ── time format ───────────────────────────────────────── */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

/* ════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════ */
export function AuditLogPageClient({ initialLogs, dbError }: { initialLogs: AuditLogRow[]; dbError: string | null }) {
  const [logs, setLogs]         = useState<AuditLogRow[]>(initialLogs);
  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(initialLogs.length === 50);
  const [filterAction, setFilterAction] = useState<string>("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  /* ── load more ─────────────────────────────────────── */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const last = logs[logs.length - 1];
    const url = new URL("/api/platform/audit-logs", window.location.origin);
    url.searchParams.set("limit", "50");
    url.searchParams.set("cursor", last.created_at);
    if (filterAction) url.searchParams.set("action", filterAction);
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        const next: AuditLogRow[] = json.logs ?? [];
        setLogs(prev => [...prev, ...next]);
        setHasMore(next.length === 50);
      }
    } finally { setLoading(false); }
  }, [loading, hasMore, logs, filterAction]);

  /* ── filter reload ─────────────────────────────────── */
  const applyFilter = useCallback(async (action: string) => {
    setFilterAction(action);
    setLoading(true);
    setExpandedId(null);
    const url = new URL("/api/platform/audit-logs", window.location.origin);
    url.searchParams.set("limit", "50");
    if (action) url.searchParams.set("action", action);
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        const next: AuditLogRow[] = json.logs ?? [];
        setLogs(next);
        setHasMore(next.length === 50);
      }
    } finally { setLoading(false); }
  }, []);

  /* ── refresh ────────────────────────────────────────── */
  const refresh = useCallback(async () => {
    setLoading(true);
    setExpandedId(null);
    const url = new URL("/api/platform/audit-logs", window.location.origin);
    url.searchParams.set("limit", "50");
    if (filterAction) url.searchParams.set("action", filterAction);
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs ?? []);
        setHasMore((json.logs ?? []).length === 50);
      }
    } finally { setLoading(false); }
  }, [filterAction]);

  return (
    <>
      <style>{`
        .al-row { transition: background 0.10s; }
        .al-row:hover { background: rgba(245,240,232,0.025); }
        .al-filter-btn {
          padding: 3px 10px; border-radius: 5px; font-size: 9px;
          font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
          background: transparent; border: 1px solid rgba(245,240,232,0.12);
          color: rgba(245,240,232,0.38); cursor: pointer; transition: all 0.12s;
          white-space: nowrap;
        }
        .al-filter-btn:hover { background: rgba(245,240,232,0.05); color: #f0ebe0; }
        .al-filter-btn[data-active] {
          background: rgba(109,40,217,0.22); border-color: rgba(139,92,246,0.45); color: #c4b5fd;
        }
        .al-load-btn {
          padding: 7px 20px; border-radius: 7px; font-size: 10px;
          font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          background: rgba(109,40,217,0.22); border: 1px solid rgba(139,92,246,0.40);
          color: #c4b5fd; cursor: pointer; transition: background 0.15s;
        }
        .al-load-btn:hover:not(:disabled) { background: rgba(109,40,217,0.35); }
        .al-load-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .al-refresh-btn {
          padding: 4px 11px; border-radius: 6px; font-size: 9.5px;
          font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
          background: transparent; border: 1px solid rgba(245,240,232,0.14);
          color: rgba(245,240,232,0.45); cursor: pointer; transition: all 0.15s;
        }
        .al-refresh-btn:hover:not(:disabled) { background: rgba(245,240,232,0.06); color: #f0ebe0; }
        .al-refresh-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        @media (prefers-reduced-motion: reduce) {
          .al-row { transition: none !important; }
          .al-filter-btn, .al-load-btn, .al-refresh-btn { transition: none !important; }
        }
      `}</style>

      {/* ── db error banner ────────────────────────────── */}
      {dbError && (
        <div style={{
          borderRadius: 10, border: "1px solid rgba(252,165,165,0.30)",
          background: "rgba(50,10,10,0.85)", padding: "12px 16px",
          marginBottom: 20, color: C.red, fontSize: 11, lineHeight: 1.55,
        }}>
          <strong style={{ display: "block", marginBottom: 4, letterSpacing: "0.08em", fontSize: 9, textTransform: "uppercase" }}>
            DB 조회 오류
          </strong>
          {dbError}
          <br />
          <span style={{ color: "rgba(252,165,165,0.55)", fontSize: 9.5 }}>
            Vercel 로그에서 <code>[audit-page] getInitialLogs</code> 키워드로 상세 오류를 확인하세요.
          </span>
        </div>
      )}

      {/* ── header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 26 }}>
        <p style={scoreboardLabel}>Platform Operations</p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{
            color: C.cream, fontSize: 26, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.15,
          }}>
            Audit Log
          </h1>
          <button className="al-refresh-btn" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
        <p style={{ color: C.muted, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
          Platform operations history — CENTER COURT 민감 작업 기록. 비밀번호·토큰·세션 정보는 저장되지 않습니다.
        </p>
      </div>

      {/* ── filter tabs ─────────────────────────────────── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="al-filter-btn"
          data-active={!filterAction ? "1" : undefined}
          onClick={() => applyFilter("")}>All</button>
        {ALL_ACTIONS.map(a => {
          const cfg = actionConfig(a);
          return (
            <button key={a} className="al-filter-btn"
              data-active={filterAction === a ? "1" : undefined}
              onClick={() => applyFilter(a)}>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── log list ─────────────────────────────────────── */}
      {logs.length === 0 && !loading ? (
        <div style={{
          borderRadius: 13, border: `1px solid ${C.border}`,
          background: "rgba(2,6,4,0.90)", padding: "32px 20px", textAlign: "center",
        }}>
          <p style={{ color: C.dim, fontSize: 13 }}>감사 로그가 없습니다.</p>
        </div>
      ) : (
        <div style={{
          borderRadius: 13, border: `1px solid ${C.border}`,
          background: "rgba(2,6,4,0.90)", overflow: "hidden",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}>
          {logs.map((log, idx) => {
            const cfg = actionConfig(log.action);
            const isExpanded = expandedId === log.id;
            return (
              <div key={log.id}>
                <div
                  className="al-row"
                  style={{
                    padding: "12px 18px",
                    borderBottom: idx < logs.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  {/* action badge */}
                  <div style={{ flexShrink: 0, paddingTop: 1 }}>
                    <span style={{
                      display: "inline-block",
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
                      whiteSpace: "nowrap",
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "#f0ebe0", fontSize: 12, fontWeight: 600 }}>
                        {log.target_label ?? log.target_id ?? "—"}
                      </span>
                      {log.target_type === "club_member" && (
                        <span style={{ fontSize: 9, color: C.dim }}>
                          {(log.metadata as { club?: string }).club ?? ""}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ color: C.muted, fontSize: 10 }}>
                        by <strong style={{ color: "rgba(196,181,253,0.7)" }}>{log.platform_admin_username}</strong>
                        {" "}<span style={{ color: C.dim, fontSize: 9 }}>({log.platform_admin_role})</span>
                      </span>
                    </div>
                  </div>

                  {/* time */}
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{ color: C.muted, fontSize: 10 }}>{timeAgo(log.created_at)}</p>
                    <p style={{ color: C.dim, fontSize: 8.5, marginTop: 1 }}>{fmtTime(log.created_at)}</p>
                  </div>

                  {/* expand indicator */}
                  <span style={{ color: C.dim, fontSize: 10, flexShrink: 0, marginTop: 4 }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: "12px 18px 14px 46px",
                    background: "rgba(109,40,217,0.06)",
                    borderBottom: idx < logs.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <p style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
                      Details
                    </p>
                    <div style={{ display: "grid", gap: 5 }}>
                      <DetailRow label="Log ID"      value={log.id} />
                      <DetailRow label="Action"      value={log.action} />
                      <DetailRow label="Target Type" value={log.target_type} />
                      {log.target_id    && <DetailRow label="Target ID"    value={log.target_id} />}
                      {log.target_label && <DetailRow label="Target"       value={log.target_label} />}
                      {log.club_id      && <DetailRow label="Club ID"      value={log.club_id} />}
                      <DetailRow label="Actor"       value={`${log.platform_admin_username} (${log.platform_admin_role})`} />
                      <DetailRow label="Timestamp"   value={fmtTime(log.created_at)} />
                    </div>
                    {Object.keys(log.metadata).length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ color: C.dim, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>
                          Metadata
                        </p>
                        <pre style={{
                          background: "rgba(0,4,2,0.7)", border: `1px solid ${C.border}`,
                          borderRadius: 7, padding: "10px 12px",
                          color: "rgba(196,181,253,0.75)", fontSize: 10.5,
                          overflowX: "auto", lineHeight: 1.6, margin: 0,
                          fontFamily: "'Courier New', monospace",
                        }}>
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── load more ───────────────────────────────────── */}
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="al-load-btn" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load More"}
          </button>
        </div>
      )}

      {!hasMore && logs.length > 0 && (
        <p style={{ color: C.dim, fontSize: 10, textAlign: "center", marginTop: 14, letterSpacing: "0.06em" }}>
          전체 {logs.length}건 표시됨
        </p>
      )}
    </>
  );
}

/* ── sub-components ─────────────────────────────────────── */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{
        color: "rgba(245,240,232,0.28)", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.10em", textTransform: "uppercase",
        flexShrink: 0, minWidth: 90,
      }}>
        {label}
      </span>
      <span style={{ color: "rgba(245,240,232,0.65)", fontSize: 10.5, wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

const scoreboardLabel: React.CSSProperties = {
  color: "rgba(196,181,253,0.45)", fontSize: 8.5, fontWeight: 700,
  letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 6,
  fontFamily: "Georgia, serif",
};
