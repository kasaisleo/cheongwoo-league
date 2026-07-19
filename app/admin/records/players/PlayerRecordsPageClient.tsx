"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { MemberType } from "@/lib/supabase/database.types";

// ── 타입 ────────────────────────────────────────────────────────
export interface PlayerRecord {
  id: string;
  name: string;
  isGuest: boolean;
  memberType: MemberType | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  lp: number | null;
  attending: number;
  noShowCount: number;
  totalCompleted: number;
  attendRate: number;
  noShowRate: number;
  gameSessionCount: number;
  participationRate: number;
  absenceRate: number;
}

// ── MemberTypeBadge ──────────────────────────────────────────────
function MemberTypeBadge({ isGuest, memberType }: { isGuest: boolean; memberType: MemberType | null }) {
  const badgeStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-muted)" };
  if (isGuest) return <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={badgeStyle}>게스트</span>;
  if (memberType === "준회원") return <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={{ ...badgeStyle, opacity: 0.75 }}>준회원</span>;
  return null;
}

// ── RankingBoard ──────────────────────────────────────────────────
function RankingBoard({ title, unit, players, href }: {
  title: string; unit: string;
  players: (PlayerRecord & { displayValue: string })[];
  href: (p: PlayerRecord) => string;
}) {
  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };
  const divStyle  = { borderColor: "var(--admin-border)" };

  if (!players.length) return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
      <div className="border-b px-4 py-2" style={divStyle}>
        <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>{title}</p>
      </div>
      <p className="px-4 py-3 text-sm" style={{ color: "var(--admin-muted)" }}>기록 없음</p>
    </div>
  );

  const [first, ...rest] = players;
  return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
      <div className="border-b px-4 py-2" style={divStyle}>
        <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>{title}</p>
      </div>
      <Link href={href(first)}>
        <div
          className="flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] hover:border-[color:var(--admin-border-strong)]"
          style={divStyle}
        >
          <span className="font-score w-5 flex-shrink-0 text-right text-lg font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>1</span>
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{first.name}</span>
            <MemberTypeBadge isGuest={first.isGuest} memberType={first.memberType} />
          </div>
          <span className="font-score text-xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>
            {first.displayValue}<span className="ml-0.5 text-[10px]" style={{ color: "var(--admin-achievement)", opacity: 0.6 }}>{unit}</span>
          </span>
        </div>
      </Link>
      {rest.map((p, i) => (
        <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={href(p)}>
          <div
            className={`flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] ${i < rest.length - 1 ? "border-b" : ""}`}
            style={{ borderColor: "var(--admin-border)" }}
          >
            <span className="font-score w-5 flex-shrink-0 text-right text-[12px] font-bold tabular-nums" style={{ color: "var(--admin-muted)" }}>{i + 2}</span>
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{p.name}</span>
              <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
            </div>
            <span className="font-score text-sm font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{p.displayValue}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── SortableSignalBoard ───────────────────────────────────────────
function SortableSignalBoard({ title, desc, emptyMsg, playersDesc, playersAsc, href }: {
  title: string; desc: string; emptyMsg?: string;
  playersDesc: (PlayerRecord & { displayValue: string; subText?: string })[];
  playersAsc:  (PlayerRecord & { displayValue: string; subText?: string })[];
  href: (p: PlayerRecord) => string;
}) {
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const players = order === "desc" ? playersDesc : playersAsc;
  const allZero = order === "desc" && players.every((p) => p.displayValue.startsWith("0/") || p.displayValue === "0%");

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };

  return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
      <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--admin-border)" }}>
        <div>
          <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>{title}</p>
          <p className="text-[9px]" style={{ color: "var(--admin-muted)", opacity: 0.7 }}>{desc}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setOrder("desc")}
            className="rounded-sm px-2 py-0.5 text-[9px] font-semibold transition-colors"
            style={order === "desc"
              ? { background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-text)" }
              : { color: "var(--admin-muted)" }}>
            높은 순
          </button>
          <button type="button" onClick={() => setOrder("asc")}
            className="rounded-sm px-2 py-0.5 text-[9px] font-semibold transition-colors"
            style={order === "asc"
              ? { background: "var(--admin-surface-raised,var(--admin-surface))", color: "var(--admin-text)" }
              : { color: "var(--admin-muted)" }}>
            낮은 순
          </button>
        </div>
      </div>
      {!players.length ? (
        <p className="px-4 py-3 text-sm" style={{ color: "var(--admin-muted)" }}>기록 없음</p>
      ) : allZero && emptyMsg ? (
        <div className="px-4 py-4">
          <p className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{emptyMsg}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--admin-muted)" }}>{desc}</p>
        </div>
      ) : players.map((p, idx) => (
        <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={href(p)}>
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] ${idx < players.length - 1 ? "border-b" : ""}`}
            style={{ borderColor: "var(--admin-border)" }}
          >
            <span
              className="font-score w-5 flex-shrink-0 text-right text-[12px] font-bold tabular-nums"
              style={{ color: idx === 0 && order === "desc" ? "var(--admin-accent)" : "var(--admin-muted)" }}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
              </div>
              {p.subText && <p className="text-[9px]" style={{ color: "var(--admin-muted)" }}>{p.subText}</p>}
            </div>
            <span
              className="font-score text-sm font-bold tabular-nums"
              style={{ color: idx === 0 && order === "desc" ? "var(--admin-accent)" : "var(--admin-muted)" }}
            >
              {p.displayValue}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function PlayerRecordsPageClient({ players }: { players: PlayerRecord[] }) {
  const [query, setQuery] = useState("");
  const [showDirectory, setShowDirectory] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  const top5Participation = [...players].sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.wins - a.wins || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5WinRate      = [...players].filter((p) => p.games >= 1).sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5Attend       = [...players].filter((p) => !p.isGuest && p.totalCompleted > 0).sort((a, b) => b.attendRate - a.attendRate || b.attending - a.attending || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5LP           = [...players].filter((p) => !p.isGuest && p.lp !== null).sort((a, b) => (b.lp ?? 0) - (a.lp ?? 0)).slice(0, 5);
  const absenceBase = [...players].filter((p) => !p.isGuest && p.totalCompleted > 0);
  const top5AbsenceDesc = absenceBase.sort((a, b) => b.absenceRate - a.absenceRate || (b.totalCompleted - b.gameSessionCount) - (a.totalCompleted - a.gameSessionCount) || b.totalCompleted - a.totalCompleted || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5AbsenceAsc  = [...absenceBase].sort((a, b) => a.absenceRate - b.absenceRate || b.gameSessionCount - a.gameSessionCount || b.totalCompleted - a.totalCompleted || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const noShowBase = [...players].filter((p) => !p.isGuest && p.attending >= 1);
  const top5NoShowDesc = noShowBase.sort((a, b) => b.noShowRate - a.noShowRate || b.noShowCount - a.noShowCount || b.attending - a.attending || a.name.localeCompare(b.name, "ko")).slice(0, 5);
  const top5NoShowAsc  = [...noShowBase].sort((a, b) => a.noShowRate - b.noShowRate || b.attending - a.attending || a.noShowCount - b.noShowCount || a.name.localeCompare(b.name, "ko")).slice(0, 5);

  const playerHref = (p: PlayerRecord) => p.isGuest ? `/admin/records/players/guest/${p.id}` : `/admin/records/players/member/${p.id}`;
  const sortedAll = [...players].sort((a, b) => b.games - a.games || b.winRate - a.winRate || a.name.localeCompare(b.name, "ko"));

  const cardStyle = { borderColor: "var(--admin-border)", background: "var(--admin-surface)" };

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="선수 기록 분석"
        backHref="/admin/records"
      />

      {players.length === 0 ? (
        <p className="text-center text-sm" style={{ color: "var(--admin-muted)" }}>기록이 없어요.</p>
      ) : (
        <>
          {/* ── Leaders */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>Leaders</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "참여도", p: top5Participation[0], val: top5Participation[0] ? `${top5Participation[0].games}` : "—", unit: "경기" },
                { label: "승률",   p: top5WinRate[0],       val: top5WinRate[0] ? `${top5WinRate[0].winRate}` : "—",         unit: "%" },
                { label: "출석 체크율", p: top5Attend[0],   val: top5Attend[0] ? `${top5Attend[0].attendRate}` : "—",        unit: "%" },
                { label: "LP",     p: top5LP[0],            val: top5LP[0] ? `${top5LP[0].lp}` : "—",                       unit: "LP" },
              ].map(({ label, p, val, unit }) => (
                <div key={label} className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
                  {p ? (
                    <Link href={playerHref(p)} className="block px-4 py-3 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]">
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>{label}</p>
                      <p className="font-score mt-1 text-2xl font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>
                        {val}<span className="ml-0.5 text-[10px]" style={{ color: "var(--admin-achievement)", opacity: 0.6 }}>{unit}</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                        <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                      </div>
                    </Link>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>{label}</p>
                      <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>기록 없음</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Rankings */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>Rankings</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RankingBoard title="참여도 TOP 5" unit="경기" players={top5Participation.map((p) => ({ ...p, displayValue: `${p.games}` }))} href={playerHref} />
              <RankingBoard title="승률 TOP 5"   unit="%" players={top5WinRate.map((p) => ({ ...p, displayValue: `${p.winRate}%` }))} href={playerHref} />
              <RankingBoard title="출석 체크율 TOP 5" unit="%" players={top5Attend.map((p) => ({ ...p, displayValue: `${p.attendRate}%` }))} href={playerHref} />
              <RankingBoard title="LP TOP 5"     unit="LP" players={top5LP.map((p) => ({ ...p, displayValue: `${p.lp}` }))} href={playerHref} />
            </div>
          </section>

          {/* ── Management Signals */}
          <section className="mb-5">
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>Management Signals</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SortableSignalBoard
                title="미참여도 TOP 5"
                desc="완료 매치 중 실제 경기 기록이 없는 비율"
                playersDesc={top5AbsenceDesc.map((p) => ({ ...p, displayValue: `${p.totalCompleted - p.gameSessionCount}/${p.totalCompleted} · ${p.absenceRate}%`, subText: `참여 ${p.gameSessionCount}회` }))}
                playersAsc={top5AbsenceAsc.map((p) => ({ ...p, displayValue: `${p.totalCompleted - p.gameSessionCount}/${p.totalCompleted} · ${p.absenceRate}%`, subText: `참여 ${p.gameSessionCount}회` }))}
                href={playerHref}
              />
              <SortableSignalBoard
                title="출석 후 미참여 TOP 5"
                desc="출석 체크 후 경기 기록이 없는 매치 비율"
                emptyMsg="출석 후 경기 미참여 기록이 없습니다."
                playersDesc={top5NoShowDesc.map((p) => ({ ...p, displayValue: `${p.noShowCount}/${p.attending} · ${p.noShowRate}%`, subText: `출석 ${p.attending}회` }))}
                playersAsc={top5NoShowAsc.map((p) => ({ ...p, displayValue: `${p.noShowCount}/${p.attending} · ${p.noShowRate}%`, subText: `출석 ${p.attending}회` }))}
                href={playerHref}
              />
            </div>
          </section>

          {/* ── Player Search + Directory */}
          <section>
            <p className="mb-2 font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>Player Search</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 검색 (회원 + 게스트)"
              className="mb-3 h-9 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
            />

            {query.trim() && (
              <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
                {filtered.length === 0
                  ? <p className="px-4 py-3 text-sm" style={{ color: "var(--admin-muted)" }}>결과 없음</p>
                  : filtered.slice(0, 15).map((p, idx) => (
                    <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={playerHref(p)}>
                      <div
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] ${idx < Math.min(filtered.length, 15) - 1 ? "border-b" : ""}`}
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="text-[15px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                          <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                        </div>
                        <span className="text-[11px]" style={{ color: "var(--admin-muted)" }}>
                          <span className="font-score tabular-nums">{p.games}</span><span className="unit-kr">경기</span>
                          <span className="mx-0.5">·</span>
                          <span className="font-score tabular-nums" style={{ color: "var(--admin-achievement)" }}>{p.winRate}%</span>
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>→</span>
                      </div>
                    </Link>
                  ))
                }
              </div>
            )}

            {!query.trim() && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowDirectory((v) => !v)}
                  className="flex w-full items-center justify-between rounded-[var(--admin-button-radius,6px)] border px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] hover:border-[color:var(--admin-border-strong)]"
                  style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
                >
                  <span className="font-display text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                    전체 기록 리스트 ({players.length}명)
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{showDirectory ? "▲ 접기" : "▼ 보기"}</span>
                </button>

                {showDirectory && (
                  <div className="mt-1 overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={cardStyle}>
                    <div className="flex items-center gap-2 border-b px-4 py-1.5" style={{ borderColor: "var(--admin-border)" }}>
                      <span className="flex-1 font-display text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>선수</span>
                      <span className="w-10 text-right font-display text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>경기</span>
                      <span className="w-10 text-right font-display text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>승률</span>
                      <span className="w-12 text-right font-display text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>미참여</span>
                    </div>
                    {sortedAll.slice(0, 30).map((p, idx, arr) => (
                      <Link key={(p.isGuest ? "G:" : "M:") + p.id} href={playerHref(p)}>
                        <div
                          className={`flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))] ${idx < arr.length - 1 ? "border-b" : ""}`}
                          style={{ borderColor: "var(--admin-border)" }}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-1.5">
                            <span className="text-[14px] font-semibold leading-snug" style={{ color: "var(--admin-text)" }}>{p.name}</span>
                            <MemberTypeBadge isGuest={p.isGuest} memberType={p.memberType} />
                          </div>
                          <span className="w-10 text-right font-score text-[12px] tabular-nums" style={{ color: "var(--admin-muted)" }}>{p.games}</span>
                          <span className="w-10 text-right font-score text-[12px] font-bold tabular-nums" style={{ color: "var(--admin-achievement)" }}>{p.winRate}%</span>
                          <span className="w-12 text-right font-score text-[12px] tabular-nums" style={{ color: "var(--admin-muted)" }}>
                            {(!p.isGuest && p.totalCompleted > 0) ? `${p.absenceRate}%` : "—"}
                          </span>
                        </div>
                      </Link>
                    ))}
                    {players.length > 30 && (
                      <p className="border-t px-4 py-2 text-center text-[9px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}>
                        상위 30명 · 검색으로 찾기
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
