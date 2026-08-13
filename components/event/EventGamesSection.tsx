"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * EventGamesSection — 수동 대진 구성(0054, 2A-6B-2) + 게임 결과 관리(0059, 2A-7B-2D).
 *
 * 범위: 대진 생성 / 선수 지정 / 세션 배치·이동 / 순서 변경 / 취소 /
 *       결과 저장·수정·초기화.
 * 범위 밖(만들지 않음): 자동 편성, 경기 시작·종료 전환, 검수, games_confirmed_at.
 *
 * 게이트 정책 — RPC 계약과 정확히 일치시킨다:
 *   - 게임 RPC들은 participants_confirmed_at / scheduling_confirmed_at을
 *     "보지 않는다". 따라서 이 UI도 그 두 값으로 잠그지 않는다.
 *   - 0058 이후 배정 자격은 is_active 하나뿐이다(status='confirmed' 요구 제거).
 *   - Event 전체 잠금은 cancelled 하나뿐이다. completed Event에서도 대진과
 *     결과를 계속 다룰 수 있다.
 *   - 게임 단위 잠금은 두 축이 다르다:
 *       구조(선수·배치·순서·취소) → game.status === 'draft'일 때만
 *       결과(저장·수정·초기화)   → game.status !== 'cancelled'일 때
 *     즉 완료된 게임은 선수를 바꿀 수 없지만 점수는 정정할 수 있다. 선수를
 *     바꾸려면 결과를 먼저 초기화해 draft로 되돌려야 한다.
 *   - 결과 입력은 복식만 지원한다(0059 — matches의 슬롯 XOR CHECK 때문).
 *   - 그 외 모든 유효성(정원, 중복, 슬롯 점유, 시간 충돌, 점수 범위, 동점,
 *     타이브레이크, 효과 undo/apply)은 서버 RPC가 최종 판정하고, 이 컴포넌트는
 *     실패 메시지를 그대로 노출한다. 승자·상태를 여기서 계산하지 않는다.
 */

interface EventGamesSectionProps {
  eventId: string;
  scheduling: SchedulingSnapshot | null;
  participants: EventParticipant[];
  /** 대진 변경 후 부모의 refreshAll()만 호출한다 — 이 컴포넌트가 직접 재조회하지 않는다. */
  onChanged: () => void | Promise<void>;
}

type LineupDraft = Record<string, string>; // "A:1" | "A:2" | "B:1" | "B:2" -> event_participant_id

/** 결과 입력 폼의 로컬 값. 저장 실패 시 재입력이 필요 없도록 게임별로 유지한다. */
interface ResultDraft {
  scoreA: string;
  scoreB: string;
  tieA: string;
  tieB: string;
}

const EMPTY_RESULT_DRAFT: ResultDraft = { scoreA: "", scoreB: "", tieA: "", tieB: "" };

/** 0061 RPC와 API 라우트가 강제하는 목표 게임 수 범위. 여기서는 입력 편의용. */
const MIN_BULK_TARGET = 1;
const MAX_BULK_TARGET = 200;

/** 빈 draft Game 일괄 확보에 필요한 최소 확정 인원(복식 1경기). */
const MIN_CONFIRMED_FOR_BULK = 4;

/** 저장된 결과를 폼 초기값으로 되돌린다(수정 진입 시). */
function resultToDraft(r: EventGameWithPlayers["result"]): ResultDraft {
  if (!r) return EMPTY_RESULT_DRAFT;
  return {
    scoreA: String(r.score_a),
    scoreB: String(r.score_b),
    tieA: r.score_a_tiebreak === null ? "" : String(r.score_a_tiebreak),
    tieB: r.score_b_tiebreak === null ? "" : String(r.score_b_tiebreak),
  };
}

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
  /**
   * busy state만으로는 같은 tick에 들어온 두 번째 호출을 막지 못한다 —
   * setBusy(true)가 리렌더 전이라 두 호출 모두 busy=false를 읽고 통과한다
   * (Production QA에서 저장 버튼 연속 2회 클릭 시 POST가 2건 나간 것을 실측).
   * 요청 시작 시점에 동기적으로 세워지는 ref를 실제 게이트로 쓰고, busy는
   * 버튼 disabled/loading 표시용으로만 유지한다.
   */
  const mutationLockRef = useRef(false);

  /** 빈 draft Game 일괄 확보(0061) — 목표 수는 저장하지 않고 요청 인자로만 쓴다. */
  const [showBulk, setShowBulk] = useState(false);
  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkConfirmTarget, setBulkConfirmTarget] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [format, setFormat] = useState<EventGameFormat>("doubles");
  const [draft, setDraft] = useState<LineupDraft>({});
  const [createSessionId, setCreateSessionId] = useState<string>("");

  const [editingPlayersFor, setEditingPlayersFor] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LineupDraft>({});

  const [cancelTarget, setCancelTarget] = useState<EventGameWithPlayers | null>(null);

  /** 결과 폼을 펼친 게임과 게임별 입력값(저장 실패 시에도 유지). */
  const [editingResultFor, setEditingResultFor] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [saveResultTarget, setSaveResultTarget] = useState<EventGameWithPlayers | null>(null);
  const [clearResultTarget, setClearResultTarget] = useState<EventGameWithPlayers | null>(null);

  /** 0058: Event 전체 잠금은 cancelled 하나뿐. completed는 잠금이 아니다. */
  const locked = scheduling?.event.isCancelled ?? false;
  const slotMode = scheduling?.event.slotMode ?? "none";

  /**
   * 일괄 확보(0061)만 예외적으로 completed도 차단한다 — 완료된 이벤트에 빈
   * 게임을 더 만드는 조작은 운영상 의미가 없다(2A-8B 확정 정책 2). 나머지
   * 기능의 잠금 계약은 그대로다.
   */
  const isCompleted = scheduling?.event.isCompleted ?? false;
  const participantsConfirmed = (scheduling?.event.participants_confirmed_at ?? null) !== null;
  /** RPC guard와 같은 정의 — status='confirmed' + is_active. */
  const confirmedActiveCount = useMemo(
    () => participants.filter((p) => p.is_active && p.status === "confirmed").length,
    [participants]
  );
  const canBulkCreate =
    !locked && !isCompleted && participantsConfirmed && confirmedActiveCount >= MIN_CONFIRMED_FOR_BULK;

  /** 대진에 넣을 수 있는 참가자 = is_active (0058이 status='confirmed' 요구를 제거). */
  const eligible = useMemo(
    () => participants.filter((p) => p.is_active),
    [participants]
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

  /**
   * 모든 쓰기 공통 래퍼 — 중복 요청 차단, 실패 메시지 노출, 성공 시 대진+부모
   * 동시 갱신. 결과 저장·수정·초기화를 포함한 이 컴포넌트의 모든 mutation이
   * 이 함수 하나를 거치므로, 잠금도 여기 한 곳에만 둔다.
   */
  async function mutate(
    url: string,
    init: RequestInit,
    /**
     * 문자열이면 그대로, 함수면 응답 본문으로 문구를 만든다 — 일괄 확보처럼
     * "몇 개가 실제로 생성됐는지"에 따라 안내가 달라지는 경우에만 함수를 쓴다.
     */
    successMsg: string | ((body: unknown) => string),
    fallbackMsg: string
  ) {
    // fetch 호출 직전에 동기적으로 잠근다 — ConfirmDialog를 여는 시점이 아니라
    // 실제 요청 시작 시점이어야 취소 시 잠금이 남지 않는다.
    if (mutationLockRef.current) return false;
    mutationLockRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? fallbackMsg);
        return false;
      }
      toast.success(typeof successMsg === "string" ? successMsg : successMsg(body));
      await loadGames();
      await onChanged();
      return true;
    } catch {
      toast.error(fallbackMsg);
      return false;
    } finally {
      // 성공·실패·예외 어느 경로로 빠져나가도 반드시 함께 해제한다.
      mutationLockRef.current = false;
      setBusy(false);
    }
  }

  /**
   * 빈 doubles draft Game을 목표 수까지 확보한다(0061).
   *
   * 멱등 연산이므로 같은 목표로 다시 눌러도 서버가 아무것도 만들지 않는다.
   * 목표가 현재보다 작아도 기존 게임을 취소하지 않는다 — 안내만 달라진다.
   * 잠금은 mutate() 안의 mutationLockRef 하나가 담당하고, 여기서는 요청을
   * ConfirmDialog 확인 이후에만 시작한다.
   */
  async function handleBulkEnsure(target: number) {
    const ok = await mutate(
      `/api/admin/events/${eventId}/games/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCount: target }),
      },
      (body) => {
        const r = body as { createdCount?: number; previousCount?: number; targetCount?: number } | null;
        const created = r?.createdCount ?? 0;
        const prev = r?.previousCount ?? 0;
        const wanted = r?.targetCount ?? target;
        if (created > 0) return `빈 게임 ${created}개를 생성했습니다. (총 ${prev + created}경기)`;
        if (wanted < prev) return `목표 ${wanted}경기가 현재 게임 수보다 작아 변경되지 않았습니다.`;
        return "추가 생성할 게임이 없습니다.";
      },
      "게임 일괄 생성에 실패했습니다."
    );
    if (ok) {
      setShowBulk(false);
      setBulkTarget("");
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

  /**
   * 결과 저장·수정 — 점수 4칸만 보내고 선수는 서버가 현재 라인업에서 직접 읽는다.
   * 승자·Game 상태·Match 연결·포인트 효과는 전부 RPC가 정하므로 여기서
   * 낙관적으로 확정 표시하지 않고, 성공 후 재조회 결과로만 렌더링한다.
   */
  async function handleSaveResult(game: EventGameWithPlayers) {
    const d = resultDrafts[game.id] ?? EMPTY_RESULT_DRAFT;
    if (d.scoreA.trim() === "" || d.scoreB.trim() === "") {
      toast.error("양 팀 점수를 모두 입력해주세요.");
      return;
    }
    const ok = await mutate(
      `/api/admin/events/${eventId}/games/${game.id}/result`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreA: d.scoreA.trim(),
          scoreB: d.scoreB.trim(),
          scoreATiebreak: d.tieA.trim() === "" ? null : d.tieA.trim(),
          scoreBTiebreak: d.tieB.trim() === "" ? null : d.tieB.trim(),
        }),
      },
      "경기 결과를 저장했습니다.",
      "경기 결과 저장에 실패했습니다."
    );
    // 실패하면 입력값을 그대로 남겨 재입력이 필요 없게 한다.
    if (ok) {
      setEditingResultFor(null);
      setResultDrafts((prev) => {
        const next = { ...prev };
        delete next[game.id];
        return next;
      });
    }
  }

  /** 결과 초기화 — 효과 undo·Match 삭제·draft 복구는 전부 RPC가 한 트랜잭션에서 처리한다. */
  async function handleClearResult(game: EventGameWithPlayers) {
    const ok = await mutate(
      `/api/admin/events/${eventId}/games/${game.id}/result`,
      { method: "DELETE" },
      "경기 결과를 초기화했습니다.",
      "경기 결과 초기화에 실패했습니다."
    );
    if (ok) {
      setEditingResultFor(null);
      setResultDrafts((prev) => {
        const next = { ...prev };
        delete next[game.id];
        return next;
      });
    }
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

    // 결과 액션 가능 여부 — DB가 명확히 금지하는 경우만 선제적으로 막고,
    // 나머지 판정은 서버에 맡긴다.
    const seatCount = game.format === "singles" ? 2 : 4;
    const lineupComplete =
      game.players.length === seatCount &&
      new Set(game.players.map((p) => p.event_participant_id)).size === seatCount;
    const resultBlockedReason = locked
      ? "취소된 경기입니다."
      : isCancelled
        ? "취소된 게임에는 결과를 저장할 수 없습니다."
        : game.format !== "doubles"
          ? "현재 결과 입력은 복식 게임만 지원합니다."
          : !lineupComplete
            ? "선수 4명이 모두 배정되어야 결과를 입력할 수 있습니다."
            : null;
    const canEditResult = resultBlockedReason === null;
    const draftValue = resultDrafts[game.id] ?? EMPTY_RESULT_DRAFT;
    const winnerLabel =
      game.result === null ? null : game.result.winner_team === "A" ? "A팀 승" : "B팀 승";

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
            {/* 0061의 빈 Game은 players가 0행이다 — "— vs —"로 뭉개지 않고 상태를 명시한다. */}
            {game.players.length === 0 ? (
              <p className="mt-1 text-[13px] font-semibold text-[color:var(--surface-muted)]">선수 미배정</p>
            ) : (
              <p className="mt-1 truncate text-[13px] font-semibold text-[color:var(--surface-text)]">
                {game.players.filter((p) => p.team === "A").map((p) => p.display_name).join(", ") || "—"}
                <span className="mx-1.5 text-[color:var(--surface-muted)]">vs</span>
                {game.players.filter((p) => p.team === "B").map((p) => p.display_name).join(", ") || "—"}
              </p>
            )}
            {game.result && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="font-bold text-[color:var(--surface-text)]">
                  {game.result.score_a} : {game.result.score_b}
                </span>
                {game.result.score_a_tiebreak !== null && game.result.score_b_tiebreak !== null && (
                  <span className="text-[10px] text-[color:var(--surface-muted)]">
                    (타이브레이크 {game.result.score_a_tiebreak}:{game.result.score_b_tiebreak})
                  </span>
                )}
                <span
                  className="rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    borderColor: "var(--admin-accent)",
                    background: "var(--admin-accent-soft)",
                    color: "var(--admin-accent)",
                  }}
                >
                  {winnerLabel}
                </span>
              </p>
            )}
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

        {/*
          결과 관리 — 구조 잠금(draft 전용)과 축이 다르다. 완료된 게임도 점수
          정정과 초기화가 가능하고, 선수를 바꾸려면 먼저 초기화해 draft로
          되돌려야 한다(0059 계약).
        */}
        {!isCancelled && (
          <div className="mt-2 border-t border-[color:var(--surface-border)] pt-2">
            {!canEditResult ? (
              <p className="text-[11px] text-[color:var(--surface-muted)]">{resultBlockedReason}</p>
            ) : editingResultFor === game.id ? (
              <div className="rounded-[10px] border border-[color:var(--surface-border)] p-2">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "scoreA", label: "A팀 점수" },
                      { key: "scoreB", label: "B팀 점수" },
                      { key: "tieA", label: "A팀 타이브레이크 (선택)" },
                      { key: "tieB", label: "B팀 타이브레이크 (선택)" },
                    ] as const
                  ).map((f) => (
                    <label key={f.key} className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-[color:var(--surface-muted)]">
                        {f.label}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className={inputCls}
                        value={draftValue[f.key]}
                        disabled={busy}
                        onChange={(e) =>
                          setResultDrafts((prev) => ({
                            ...prev,
                            [game.id]: { ...(prev[game.id] ?? EMPTY_RESULT_DRAFT), [f.key]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-[color:var(--surface-muted)]">
                  7-6 경기만 타이브레이크 점수를 입력합니다. 승패는 점수로 자동 결정됩니다.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (game.result ? setSaveResultTarget(game) : handleSaveResult(game))}
                    className="flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
                  >
                    {busy ? "저장 중..." : game.result ? "결과 수정 저장" : "결과 저장"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingResultFor(null)}
                    className="rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setResultDrafts((prev) => ({
                      ...prev,
                      [game.id]: prev[game.id] ?? resultToDraft(game.result),
                    }));
                    setEditingResultFor(game.id);
                  }}
                  className="rounded-[var(--admin-button-radius,6px)] border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
                >
                  {game.result ? "결과 수정" : "결과 입력"}
                </button>
                {game.result && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setClearResultTarget(game)}
                    className="rounded-[var(--admin-button-radius,6px)] border border-fault-400/40 px-3 py-1.5 text-xs font-semibold text-fault-400 disabled:opacity-40"
                  >
                    결과 초기화
                  </button>
                )}
              </div>
            )}
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
          취소된 경기입니다 — 대진과 결과가 잠겨 있습니다.
        </div>
      )}

      {!locked && eligible.length === 0 && (
        <p className="mb-3 rounded-[10px] border border-[color:var(--surface-border)] px-3 py-2 text-xs text-[color:var(--surface-muted)]">
          확정된 참가자가 없습니다 — 참가자 명단을 먼저 확정하면 대진을 만들 수 있습니다.
        </p>
      )}

      {/* 빈 draft Game 일괄 확보(0061) — 목표 수는 저장하지 않는 요청 인자다. */}
      {canBulkCreate && (
        <div className="mb-3">
          {!showBulk ? (
            <button
              type="button"
              onClick={() => {
                setShowBulk(true);
                setBulkTarget(String(activeGames.length));
              }}
              className="w-full rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-2 text-xs font-semibold text-[color:var(--surface-muted)]"
            >
              게임 일괄 생성
            </button>
          ) : (
            <div className="rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] p-3">
              <p className="mb-2 text-[11px] text-[color:var(--surface-muted)]">
                현재 {activeGames.length}경기 · 확정 참가자 {confirmedActiveCount}명
              </p>
              <label className="mb-1 block text-[11px] font-semibold text-[color:var(--surface-muted)]">
                목표 게임 수 ({MIN_BULK_TARGET} ~ {MAX_BULK_TARGET})
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_BULK_TARGET}
                max={MAX_BULK_TARGET}
                step={1}
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1.5 text-[11px] text-[color:var(--surface-muted)]">
                목표 수보다 부족한 만큼만 빈 복식 게임을 만듭니다. 선수는 생성 후 각 게임에서
                배정하세요. 목표 수가 현재보다 작아도 기존 게임은 취소되지 않습니다.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const n = Number(bulkTarget);
                    if (
                      bulkTarget.trim() === "" ||
                      !Number.isInteger(n) ||
                      n < MIN_BULK_TARGET ||
                      n > MAX_BULK_TARGET
                    ) {
                      toast.error(`목표 게임 수를 ${MIN_BULK_TARGET} ~ ${MAX_BULK_TARGET} 사이 정수로 입력해주세요.`);
                      return;
                    }
                    setBulkConfirmTarget(n);
                  }}
                  className="flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  style={{
                    borderColor: "var(--admin-accent)",
                    background: "var(--admin-accent-soft)",
                    color: "var(--admin-accent)",
                  }}
                >
                  {busy ? "생성 중..." : "생성"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowBulk(false);
                    setBulkTarget("");
                  }}
                  className="rounded-[var(--admin-button-radius,6px)] border border-[color:var(--surface-border)] px-3 py-2 text-sm font-semibold text-[color:var(--surface-muted)] disabled:opacity-50"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* eligible이 0명일 때는 위의 기존 안내가 이미 같은 내용을 덮으므로 중복 배너를 띄우지 않는다. */}
      {!locked && !isCompleted && !canBulkCreate && eligible.length > 0 && (
        <p className="mb-3 rounded-[10px] border border-[color:var(--surface-border)] px-3 py-2 text-xs text-[color:var(--surface-muted)]">
          {!participantsConfirmed
            ? "참가자 명단을 확정하면 게임을 일괄 생성할 수 있습니다."
            : `확정 참가자가 ${confirmedActiveCount}명입니다 — 복식 게임을 만들려면 ${MIN_CONFIRMED_FOR_BULK}명 이상이어야 합니다.`}
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
        open={bulkConfirmTarget !== null}
        title="빈 게임을 일괄 생성할까요?"
        description={
          bulkConfirmTarget === null
            ? ""
            : bulkConfirmTarget <= activeGames.length
              ? `목표 ${bulkConfirmTarget}경기는 현재 ${activeGames.length}경기보다 크지 않아 아무것도 생성되지 않습니다. 기존 게임은 취소되지 않습니다.`
              : `현재 ${activeGames.length}경기에서 목표 ${bulkConfirmTarget}경기까지 빈 복식 게임 ${
                  bulkConfirmTarget - activeGames.length
                }개를 만듭니다. 생성된 게임은 삭제할 수 없고 개별 취소만 가능합니다.`
        }
        confirmLabel="일괄 생성"
        onConfirm={() => {
          const target = bulkConfirmTarget;
          setBulkConfirmTarget(null);
          if (target !== null) handleBulkEnsure(target);
        }}
        onCancel={() => setBulkConfirmTarget(null)}
      />

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

      <ConfirmDialog
        open={saveResultTarget !== null}
        title="저장된 결과를 수정할까요?"
        description="이미 반영된 승패와 포인트를 되돌린 뒤 새 점수로 다시 반영합니다. 승자가 바뀌면 선수들의 승패 기록도 함께 바뀝니다."
        confirmLabel="결과 수정"
        onConfirm={() => {
          const target = saveResultTarget;
          setSaveResultTarget(null);
          if (target) handleSaveResult(target);
        }}
        onCancel={() => setSaveResultTarget(null)}
      />

      <ConfirmDialog
        open={clearResultTarget !== null}
        title="이 게임의 결과를 초기화할까요?"
        description="저장된 경기 기록이 삭제되고, 반영됐던 포인트와 승패 기록이 되돌려집니다. 게임은 다시 대진 수정이 가능한 상태로 돌아갑니다."
        confirmLabel="결과 초기화"
        onConfirm={() => {
          const target = clearResultTarget;
          setClearResultTarget(null);
          if (target) handleClearResult(target);
        }}
        onCancel={() => setClearResultTarget(null)}
      />
    </div>
  );
}
