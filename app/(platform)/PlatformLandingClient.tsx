"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Props {
  clubs: Club[];
}

/* ─────────────────────────────────────────────────────────
   SUPER MATCH — Platform Landing Client
   Wimbledon-inspired design, covers root layout via
   fixed inset-0 z-[9999].
───────────────────────────────────────────────────────── */
export function PlatformLandingClient({ clubs }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [clubs, query]);

  return (
    <>
      <SmStyles />

      {/* ── root layout 완전 차단 ── */}
      <div
        className="sm-landing-wrap"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          overflowY: "auto",
          background: [
            "radial-gradient(ellipse at 50% 15%, rgba(255,255,255,0.04) 0%, transparent 55%)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.038) 0px, rgba(255,255,255,0.038) 10px, transparent 10px, transparent 90px)",
            "linear-gradient(170deg, #082d21 0%, #0a3328 45%, #061d14 100%)",
          ].join(", "),
        }}
      >
        {/* 코트 라인 SVG */}
        <div
          className="pointer-events-none"
          style={{ position: "fixed", inset: 0, zIndex: 0 }}
        >
          <svg
            style={{ width: "100%", height: "100%", opacity: 0.05 }}
            viewBox="0 0 200 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="10" y="6" width="180" height="88" fill="none" stroke="#f5f0e8" strokeWidth="0.55" />
            <line x1="24"  y1="6"  x2="24"  y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="176" y1="6"  x2="176" y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="10"  y1="50" x2="190" y2="50" stroke="#f5f0e8" strokeWidth="0.8"  />
            <line x1="24"  y1="28" x2="176" y2="28" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="24"  y1="72" x2="176" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="100" y1="28" x2="100" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="100" y1="6"  x2="100" y2="10" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="100" y1="90" x2="100" y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
          </svg>
        </div>

        {/* purple top accent */}
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(109,40,217,0.55) 30%, rgba(139,92,246,0.7) 50%, rgba(109,40,217,0.55) 70%, transparent 100%)",
          }}
        />

        {/* ── 본문 ── */}
        <div
          className="sm-content-wrap"
          style={{
            position: "relative",
            zIndex: 10,
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 메인 영역 */}
          <div
            className="sm-main"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div className="sm-inner">
              {/* ── 히어로 ── */}
              <div className="sm-hero">
                {/* SM 엠블렘 */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background:
                      "linear-gradient(145deg, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.18) 100%)",
                    border: "1px solid rgba(139,92,246,0.5)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 16px rgba(109,40,217,0.18)",
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(245,240,232,0.92)",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      letterSpacing: "0.04em",
                      lineHeight: 1,
                    }}
                  >
                    SM
                  </span>
                </div>

                {/* 브랜드 */}
                <p
                  style={{
                    color: "rgba(245,240,232,0.35)",
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: "0.30em",
                    textTransform: "uppercase",
                    fontFamily: "Georgia, serif",
                    marginBottom: 10,
                  }}
                >
                  Super Match
                </p>
                <h1
                  style={{
                    color: "#f5f0e8",
                    fontSize: "clamp(26px, 4vw, 38px)",
                    fontWeight: 700,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    letterSpacing: "0.04em",
                    lineHeight: 1.18,
                    marginBottom: 10,
                  }}
                >
                  Find your club.
                  <br />
                  <span style={{ color: "rgba(245,240,232,0.55)" }}>
                    Enter the court.
                  </span>
                </h1>
                <p
                  style={{
                    color: "rgba(245,240,232,0.38)",
                    fontSize: 12,
                    lineHeight: 1.6,
                    maxWidth: 240,
                    marginBottom: 24,
                  }}
                >
                  Tennis Club Platform
                  <br />
                  Choose your club and continue.
                </p>

                {/* 테니스볼 데코 (히어로 하단) */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`sm-ball-${i}`}
                      style={{
                        width: i === 2 ? 10 : 7,
                        height: i === 2 ? 10 : 7,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle at 35% 35%, #d8ff48, #8ab800)",
                        opacity: i === 2 ? 0.6 : 0.35,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* ── 메인 패널 ── */}
              <div className="sm-panel-col">
                {/* scoreboard panel */}
                <div
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(245,240,232,0.11)",
                    background: "rgba(2,6,4,0.90)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.65)",
                    overflow: "hidden",
                  }}
                >
                  {/* 패널 헤더 */}
                  <div
                    style={{
                      padding: "14px 18px 12px",
                      borderBottom: "1px solid rgba(245,240,232,0.07)",
                      background:
                        "linear-gradient(135deg, rgba(70,20,150,0.22) 0%, rgba(2,6,4,0.0) 100%)",
                    }}
                  >
                    <p
                      style={{
                        color: "rgba(196,181,253,0.55)",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontFamily: "Georgia, serif",
                        marginBottom: 2,
                      }}
                    >
                      Choose Your Club
                    </p>
                    <p
                      style={{
                        color: "rgba(245,240,232,0.2)",
                        fontSize: 9,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {query.trim()
                        ? `${filtered.length} matching`
                        : `${clubs.length} club${clubs.length !== 1 ? "s" : ""} available`}
                    </p>
                  </div>

                  {/* 검색 */}
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(245,240,232,0.06)",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      {/* 검색 아이콘 */}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        style={{
                          position: "absolute",
                          left: 11,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          opacity: 0.3,
                        }}
                      >
                        <circle cx="5.5" cy="5.5" r="4" stroke="#f5f0e8" strokeWidth="1.3" />
                        <line x1="8.5" y1="8.5" x2="12.5" y2="12.5" stroke="#f5f0e8" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <input
                        type="search"
                        className="sm-search"
                        placeholder="Search clubs"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* 클럽 리스트 */}
                  <div className="sm-club-list">
                    {filtered.length === 0 ? (
                      <div
                        style={{
                          padding: "28px 18px",
                          textAlign: "center",
                          color: "rgba(245,240,232,0.28)",
                          fontSize: 12,
                        }}
                      >
                        {query.trim()
                          ? "No matching clubs."
                          : "No clubs available."}
                      </div>
                    ) : (
                      filtered.map((club, idx) => (
                        <ClubRow
                          key={club.id}
                          club={club}
                          isLast={idx === filtered.length - 1}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* ── CREATE A CLUB CTA ── */}
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 13,
                    border: "1px solid rgba(245,240,232,0.09)",
                    background: "rgba(2,6,4,0.80)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: "rgba(196,181,253,0.45)",
                        fontSize: 8.5,
                        fontWeight: 700,
                        letterSpacing: "0.20em",
                        textTransform: "uppercase",
                        fontFamily: "Georgia, serif",
                        marginBottom: 4,
                      }}
                    >
                      Create a Club
                    </p>
                    <p
                      style={{
                        color: "rgba(245,240,232,0.38)",
                        fontSize: 11,
                        lineHeight: 1.5,
                      }}
                    >
                      Want to open your own SUPER MATCH club?
                      <br />
                      <span style={{ color: "rgba(245,240,232,0.22)", fontSize: 10 }}>
                        Contact the operator to create a new club.
                      </span>
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "6px 14px",
                      borderRadius: 7,
                      border: "1px solid rgba(245,240,232,0.12)",
                      background: "rgba(245,240,232,0.04)",
                      color: "rgba(245,240,232,0.25)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "not-allowed",
                      flexShrink: 0,
                    }}
                    aria-disabled="true"
                  >
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── footer ── */}
          <footer
            style={{
              textAlign: "center",
              padding: "16px 0 20px",
              position: "relative",
              zIndex: 10,
            }}
          >
            <Link
              href="/center-court"
              style={{
                color: "rgba(245,240,232,0.18)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              className="sm-op-link"
            >
              Operator ↗
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}

/* ── Club Row ─────────────────────────────────────────── */
function ClubRow({ club, isLast }: { club: Club; isLast: boolean }) {
  return (
    <Link
      href={`/c/${club.slug}`}
      className="sm-club-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 18px",
        textDecoration: "none",
        borderBottom: isLast ? "none" : "1px solid rgba(245,240,232,0.055)",
        transition: "background 0.12s",
      }}
    >
      {/* 왼쪽 accent dot */}
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(139,92,246,0.5)",
          flexShrink: 0,
        }}
      />

      {/* 클럽 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: "#f0ebe0",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {club.name}
        </p>
        {club.description && (
          <p
            style={{
              color: "rgba(245,240,232,0.32)",
              fontSize: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 1,
            }}
          >
            {club.description}
          </p>
        )}
        <p
          style={{
            color: "rgba(245,240,232,0.18)",
            fontSize: 9,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.03em",
          }}
        >
          /c/{club.slug}
        </p>
      </div>

      {/* ENTER CLUB */}
      <span className="sm-enter-btn">
        Enter →
      </span>
    </Link>
  );
}

/* ── CSS ─────────────────────────────────────────────── */
function SmStyles() {
  return (
    <style>{`
      @keyframes sm-fade-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes sm-ball-float {
        0%,100% { transform: translateY(0); }
        50%      { transform: translateY(-5px); }
      }

      .sm-landing-wrap { animation: sm-fade-in 0.35s ease-out both; }

      @media (prefers-reduced-motion: reduce) {
        .sm-landing-wrap { animation: none; }
        .sm-ball-1, .sm-ball-2, .sm-ball-3 { animation: none !important; }
      }

      .sm-ball-1 { animation: sm-ball-float 4s ease-in-out infinite; }
      .sm-ball-2 { animation: sm-ball-float 4s ease-in-out infinite 0.6s; }
      .sm-ball-3 { animation: sm-ball-float 4s ease-in-out infinite 1.2s; }

      /* 레이아웃 */
      .sm-main {
        padding: 48px 20px 24px;
      }
      .sm-inner {
        width: 100%;
        max-width: 960px;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      .sm-hero {
        /* mobile: 히어로 compact */
      }
      .sm-panel-col {
        width: 100%;
      }

      /* desktop: 2-column */
      @media (min-width: 900px) {
        .sm-main {
          padding: 0 40px;
          min-height: calc(100vh - 60px);
        }
        .sm-inner {
          flex-direction: row;
          align-items: center;
          gap: 56px;
        }
        .sm-hero {
          flex: 0 0 300px;
        }
        .sm-panel-col {
          flex: 1;
          min-width: 0;
        }
      }

      /* 검색 input */
      .sm-search {
        width: 100%;
        height: 40px;
        border-radius: 9px;
        border: 1px solid rgba(245,240,232,0.13);
        background: rgba(2,6,4,0.65);
        color: #f5f0e8;
        font-size: 13px;
        padding: 0 12px 0 34px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
        /* 브라우저 기본 search 아이콘 제거 */
        -webkit-appearance: none;
      }
      .sm-search::placeholder { color: rgba(245,240,232,0.25); }
      .sm-search::-webkit-search-cancel-button { opacity: 0.4; }
      .sm-search:focus {
        border-color: rgba(139,92,246,0.55);
        box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
      }

      /* 클럽 리스트 스크롤 영역 */
      .sm-club-list {
        /* mobile: 자연 스크롤 */
        max-height: none;
      }
      @media (min-width: 640px) {
        .sm-club-list {
          max-height: clamp(260px, 42vh, 440px);
          overflow-y: auto;
        }
        .sm-club-list::-webkit-scrollbar { width: 4px; }
        .sm-club-list::-webkit-scrollbar-track { background: transparent; }
        .sm-club-list::-webkit-scrollbar-thumb {
          background: rgba(245,240,232,0.12);
          border-radius: 2px;
        }
      }

      /* 클럽 row hover */
      .sm-club-row:hover {
        background: rgba(109,40,217,0.07) !important;
      }

      /* ENTER button */
      .sm-enter-btn {
        display: inline-flex;
        align-items: center;
        padding: 5px 11px;
        border-radius: 6px;
        border: 1px solid rgba(139,92,246,0.35);
        background: rgba(109,40,217,0.15);
        color: #c4b5fd;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        white-space: nowrap;
        flex-shrink: 0;
        transition: background 0.12s, border-color 0.12s;
      }
      .sm-club-row:hover .sm-enter-btn {
        background: rgba(109,40,217,0.30);
        border-color: rgba(139,92,246,0.6);
      }

      /* Operator link hover */
      .sm-op-link:hover {
        color: rgba(245,240,232,0.38) !important;
      }
    `}</style>
  );
}
