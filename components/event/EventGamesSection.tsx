"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SchedulingSnapshot } from "@/components/event/EventSchedulingSection";
import type {
  EventGameFormat,
  EventGameTeam,
  EventGameWithPlayers,
  EventParticipant,
} from "@/lib/supabase/database.types";

/**
 * EventGamesSection — 수동 대진 구성(0054, Phase 2A-6B-2).
 *
 * 범위: 대진 생성 / 선수 지정 / 세션 배치·이동 / 순서 변경 / 취소.
 * 범위 밖(만들지 않음): 자동 편성, 경기 시작·종료, 점수 입력, 승패, 검수,
 * 랭킹 반영, games_confirmed_at.
 *
 * 게이트 정책 — RPC 계약과 정확히 일치시킨다:
 *   - 게임 RPC들은 participants_confirmed_at / scheduling_confirmed_at을
 *     "보지 않는다"(0054 실측 확인). 따라서 이 UI도 그 두 값으로 잠그지
 *     않는다. 실제 제약은 "선수로 지정할 참가자가 status='confirmed' AND
 *     is_active여야 한다"는 것뿐이므로, 확정된 참가자가 0명일 때만 생성
 *     폼을 막고 안내한다.
 *   - 구조 잠금은 event.status가 completed/cancelled일 때만(다른 Event 섹션과 동일).
 *   - 그 외 모든 유효성(정원, 중복, 슬롯 점유, 시간 충돌, 모드별 배치 규칙)은
 *     서버 RPC가 최종 판정하고, 이 컴포넌트는 실패 메시지를 그대로 노출한다.
 */

interface EventGamesSectionProps {
  eventId: string;
  scheduling: SchedulingSnapshot | null;
  participants: EventParticipant[];
  /** 대진 변경 후 부모의 refreshAll()만 호출한다 — 이 컴포넌트가 직접 재조회하지 않는다. */
  onChanged: () => void | Promise<void>;
}

type LineupDraft = Record<string, string>; // "A:1" | "A:2" | "B:1" | "B:2" -> event_participant_id

const SINGLES_SEATS: Array<{ key: string; team: EventGameTeam; slot: number; label: string }> = [
  { key: "A:1", team: "A", slot: 1, label: "A팀" },
  { key: "B:1", team: "B", slot: 1, label: "B팀" },
];
const DOUBLES_SEATS: Array<{ key: string; team: EventGameTeam; slot: number; label: string }> = [
  { key: "A:1", team: "A", slot: 1, label: "A팀 1" },
  { key: "A:2", team: "A", slot: 2, label: "A팀 2" },
  { key: "B:1", team: "B", slot: 1, label: "B팀 1" },
  { key: "B:2", team: "B", slot: 2, label: "B팀 2" },
];

function seatsFor(format: EventGameFormat) {
  return format === "singles" ? SINGLES_SEATS : DOUBLES_SEATS;
}

function lineupToPlayers(format: EventGameFormat, draft: LineupDraft) {
  return seatsFor(format).map((s) => ({
    eventParticipantId: draft[s.key],
    team: s.team,
    slot: s.slot,
  }));
}

function isLineupComplete(format: EventGameFormat, draft: LineupDraft): boolean {
  const seats = seatsFor(format);
  const picked = seats.map((s) => draft[s.key]).filter(Boolean);
  return picked.length === seats.length && new Set(picked).size === seats.length;
}

export function EventGamesSection({ eventId, scheduling, participants, onChanged }: EventGamesSectionProps) {
  const [games, setGames] = useState<EventGameWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [format, setFormat] = useState<EventGameFormat>("doubles");
  const [draft, setDraft] = useState<LineupDraft>({});
  const [createSessionId, setCreateSessionId] = useState<string>("");

  const [editingPlayersFor, setEditingPlayersFor] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LineupDraft>({});

  const [cancelTarget, setCancelTarget] = useState<EventGameWithPlayers | null>(null);

  const locked = scheduling?.event.locked ?? false;
  const slotMode = scheduling?.event.slotMode ?? "none";

  /** 대진에 넣을 수 있는 참가자 = status confirmed + is_active (RPC의 실제 조건과 동일). */
  const eligible = useMemo(
    () => participants.filter((p) => p.status === "confirmed" && p.is_active),
    [participants]
  );
  const nameById = useMemo(
    () => new Map(eligible.map((p) => [p.id, p.display_name_snapshot])),
    [eligible]
  );

  /** 배치 가능한 슬롯(활성 코트의 활성 세션)만 평탄화. none 모드는 슬롯을 쓰지 않는다. */
  const placeableSessions = useMemo(() => {
    if (!scheduling || slotMode === "none") return [];
    return scheduling.courts
      .filter((c) => c.is_active)
      .flatMap((c) =>
        c.sessions
          .filter((s) => s.is_active)
          .map((s) => ({
            id: s.id,
            courtId: c.id,
            label: `${c.name} · ${
              slotMode === "timed" && s.starts_at
                ? new Date(s.starts_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                : `순번 ${s.position}`
            }${s.label ? ` (${s.label})` : ""}`,
          }))
      );
  }, [scheduling, slotMode]);

  const sessionMetaById = useMemo(
    () => new Map(placeableSessions.map((s) => [s.id, s])),
    [placeableSessions]
  );

  async function loadGames() {
    const res = await fetch(`/api/admin/events/${eventId}/games`);
    const body = await res.json().catch(() => null);
    if (res.ok && body) setGames(body.games ?? []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}/games`);
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (res.ok && body) setGames(body.games ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [eventId]);

  /** 모든 쓰기 공통 래퍼 — busy 유지, 실패 메시지 노출, 성공 시 대진+부모 동시 갱신. */
  async function mutate(url: string, init: RequestInit, successMsg: string, fallbackMsg: string) {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? fallbackMsg);
        return false;
      }
      toast.success(successMsg);
      await loadGames();
      await onChanged();
      return true;
    } catch {
      toast.error(fallbackMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!isLineupComplete(format, draft)) {
      toast.error(format === "singles" ? "단식은 2명을 모두 선택해주세요." : "복식은 4명을 모두 선택해주세요.");
      return;
    }
    const session = createSessionId ? sessionMetaById.get(createSessionId) : null;
    const ok = await mutate(
      `/api/admin/events/${eventId}/games`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          players: lineupToPlayers(format, draft),
          eventCourtId: session?.courtId ?? null,
          eventSessionId: session?.id ?? null,
        }),
      },
      "대진이 생성되었습니다.",
      "대진 생성에 실패했습니다."
    );
    if (ok) {
      setDraft({});
      setCreateSessionId("");
      setShowCreate(false);
    }
  }

  async function handleSetPlayers(game: EventGameWithPlayers) {
    if (!isLineupComplete(game.format, editDraft)) {
      toast.error(game.format === "singles" ? "단식은 2명을 모두 선택해주세요." : "복식은 4명을 모두 선택해주세요.");
      return;
    }
    const ok = await mutate(
      `/api/admin/events/${eventId}/games/${game.id}/players`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: lineupToPlayers(game.format, editDraft) }),
      },
      "선수가 변경되었습니다.",
      "선수 지정에 실패했습니다."
    );
    if (ok) {
      setEditingPlayersFor(null);
      setEditDraft({});
    }
  }

  async function handlePlace(game: EventGameWithPlayers, sessionId: string) {
    const session = sessionId ? sessionMetaById.get(sessionId) : null;
    await mutate(
      `/api/admin/events/${eventId}/games/${game.id}/place`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCourtId: session?.courtId ?? null,
          eventSessionId: session?.id ?? null,
        }),
      },
      sessionId ? "슬롯에 배치했습니다." : "배치를 해제했습니다.",
      "배치에 실패했습니다."
    );
  }

  async function handleCancel(game: EventGameWithPlayers) {
    await mutate(
      `/api/admin/events/${eventId}/games/${game.id}/cancel`,
      { method: "POST" },
      "게임이 취소되었습니다.",
      "게임 취소에 실패했습니다."
    );
  }

  /** none 모드 실행 큐(미배치 draft) 순서 변경 — RPC가 이 집합 전체를 요구한다. */
  async function handleReorder(queue: EventGameWithPlayers[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    const ids = queue.map((g) => g.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await mutate(
      `/api/admin/events/${eventId}/games/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: ids }),
      },
      "순서가 변경되었습니다.",
      "순서 변경에 실패했습니다."
    );
  }

  const activeGames = games.filter((g) => g.status !== "cancelled");
  const cancelledGames = games.filter((g) => g.status === "cancelled");
  /** reorder 대상과 정확히 같은 정의(draft + 미배치) — RPC 집합 요구와 어긋나지 않게 한다. */
  const noneQueue = activeGames.filter((g) => g.status === "draft" && g.event_session_id === null);

  const inputCls =
    "h-9 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-2 text-xs text-[color:var(--control-text)] focus:outline-none focus:border-[color:var(--control-border-focus)]";

  function renderSeatPicker(fmt: EventGameFormat, value: LineupDraft, onChange: (d: LineupDraft) => void) {
    const chosen = new Set(Object.values(value).filter(Boolean));
    return (
      <div className="grid grid-cols-2 gap-2">
        {seatsFor(fmt).map((seat) => (
          <label key={seat.key} className="block">
            <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">{seat.label}</span>
            <select
              className={inputCls}
              value={value[seat.key] ?? ""}
              onChange={(e) => onChange({ ...value, [seat.key]: e.target.value })}
            >
              <option value="">선택</option>
              {eligible.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={chosen.has(p.id) && value[seat.key] !== p.id}
                >
                  {p.display_name_snapshot}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }

  function renderGameCard(game: EventGameWithPlayers, queueIndex?: number) {
    const isCancelled = game.status === "cancelled";
    const isDraft = game.status === "draft";
    const sessionLabel = game.event_session_id ? sessionMetaById.get(game.event_session_id)?.label : null;

    return (
      <div
        key={game.id}
        className={`rounded-[12px] border px-3 py-2.5 ${
          isCancelled
            ? "border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] opacity-60"
            : "border-[color:var(--surface-border)] bg-[color:var(--surface-bg)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                {game.format === "singles" ? "단식" : "복식"}
              </span>
              {isCancelled && (
                <span className="rounded-sm border border-fault-400/40 bg-fault-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-fault-400">
                  취소됨
                </span>
              )}
              {!isCancelled && game.status !== "draft" && (
                <span className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                  {game.status === "in_progress" ? "진행 중" : "완료"}
                </span>
              )}
              <span className="text-[10px] text-[color:var(--surface-muted)]">
                {sessionLabel ?? (slotMode === "none" ? "미배치" : "슬롯 미지정")}
              </span>
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold text-[color:var(--surface-text)]">
              {game.players.filter((p) => p.team === "A").map((p) => p.display_name).join(", ") || "—"}
              <span className="mx-1.5 text-[color:var(--surface-muted)]">vs</span>
              {game.players.filter((p) => p.team === "B").map((p) => p.display_name).join(", ") || "—"}
            </p>
          </div>

          {!locked && isDraft && (
            <div className="flex flex-shrink-0 items-center gap-1">
              {queueIndex !== undefined && (
                <>
                  <button
                    type="button"
                    disabled={busy || queueIndex === 0}
                    onClick={() => handleReorder(noneQueue, queueIndex, -1)}
                    className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-1 text-[10px] text-[color:var(--surface-muted)] disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={busy || queueIndex === noneQueue.length - 1}
                    onClick={() => handleReorder(noneQueue, queueIndex, 1)}
                    className="rounded-sm border border-[color:var(--surface-border)] px-1.5 py-1 text-[10px] text-[color:var(--surface-muted)] disabled:opacity-30"
                  >
                    ▼
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next: LineupDraft = {};
                  for (const p of game.players) next[`${p.team}:${p.slot}`] = p.event_participant_id;
                  setEditDraft(next);
                  setEditingPlayersFor(editingPlayersFor === game.id ? null : game.id);
                }}
                className="rounded-sm border border-[color:var(--surface-border)] px-2 py-1 text-[10px] font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
              >
                선수
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelTarget(game)}
                className="rounded-sm border border-fault-400/40 px-2 py-1 text-[10px] font-semibold text-fault-400 disabled:opacity-40"
              >
                취소
              </button>
            </div>
          )}
        </div>

        {/* 슬롯 배치·이동 — ordered/timed에서만 의미가 있다(none은 슬롯을 쓰지 않음). */}
        {!locked && isDraft && slotMode !== "none" && (
          <div className="mt-2">
            <select
              className={inputCls}
              value={game.event_session_id ?? ""}
              disabled={busy}
              onChange={(e) => handlePlace(game, e.target.value)}
            >
              <option value="">미배치</option>
              {placeableSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!locked && isDraft && editingPlayersFor === game.id && (
          <div className="mt-2 rounded-[10px] border border-[color:var(--surface-border)] p-2">
            {renderSeatPicker(game.format, editDraft, setEditDraft)}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSetPlayers(game)}
                className="flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
              >
                {busy ? "저장 중..." : "선수 저장"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingPlayersFor(null);
                  setEditDraft({});
                }}
                className="rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-2 text-[13px] font-bold text-[color:var(--surface-text)]">대진 구성</h2>
        <p className="text-sm text-[color:var(--surface-muted)]">대진을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[color:var(--surface-text)]">대진 구성</h2>
        <span className="text-[10px] text-[color:var(--surface-muted)]">
          {activeGames.length}경기{cancelledGames.length > 0 ? ` · 취소 ${cancelledGames.length}` : ""}
        </span>
      </div>

      {locked && (
        <div className="mb-3 rounded-[10px] border border-fault-400/40 bg-fault-400/10 px-3 py-2 text-xs font-semibold text-fault-400">
          {scheduling?.event.status === "completed" ? "완료된" : "취소된"} 경기입니다 — 대진이 잠겨 있습니다.
        </div>
      )}

      {!locked && eligible.length === 0 && (
        <p className="mb-3 rounded-[10px] border border-[color:var(--surface-border)] px-3 py-2 text-xs text-[color:var(--surface-muted)]">
          확정된 참가자가 없습니다 — 참가자 명단을 먼저 확정하면 대진을 만들 수 있습니다.
        </p>
      )}

      <div className="mb-3 space-y-2">
        {activeGames.length === 0 ? (
          <p className="rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3 text-sm text-[color:var(--surface-muted)]">
            아직 생성된 대진이 없습니다.
          </p>
        ) : slotMode === "none" ? (
          <>
            {noneQueue.map((g, i) => renderGameCard(g, i))}
            {activeGames.filter((g) => !noneQueue.includes(g)).map((g) => renderGameCard(g))}
          </>
        ) : (
          activeGames.map((g) => renderGameCard(g))
        )}
        {cancelledGames.map((g) => renderGameCard(g))}
      </div>

      {!locked && eligible.length > 0 && (
        <>
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
            >
              + 대진 추가
            </button>
          ) : (
            <div className="rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] p-3">
              <div className="mb-2 flex gap-2">
                {(["doubles", "singles"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFormat(f);
                      setDraft({});
                    }}
                    className={`flex-1 rounded-sm border px-2 py-1.5 text-xs font-semibold ${
                      format === f
                        ? "border-[color:var(--admin-accent)] text-[color:var(--admin-accent)]"
                        : "border-[color:var(--surface-border)] text-[color:var(--surface-muted)]"
                    }`}
                  >
                    {f === "doubles" ? "복식 (4명)" : "단식 (2명)"}
                  </button>
                ))}
              </div>

              {renderSeatPicker(format, draft, setDraft)}

              {slotMode !== "none" && (
                <div className="mt-2">
                  <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">슬롯 (선택)</span>
                  <select className={inputCls} value={createSessionId} onChange={(e) => setCreateSessionId(e.target.value)}>
                    <option value="">나중에 배치</option>
                    {placeableSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreate}
                  className="flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
                >
                  {busy ? "생성 중..." : "대진 생성"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowCreate(false);
                    setDraft({});
                    setCreateSessionId("");
                  }}
                  className="rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-2 text-sm font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="이 게임을 취소할까요?"
        description="취소한 게임은 목록에 취소 상태로 남고 되돌릴 수 없습니다."
        confirmLabel="게임 취소"
        onConfirm={() => {
          const target = cancelTarget;
          setCancelTarget(null);
          if (target) handleCancel(target);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
