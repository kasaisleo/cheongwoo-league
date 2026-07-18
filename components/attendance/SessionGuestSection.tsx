"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/components/ui/Toast";

// ── 타입 ───────────────────────────────────────────────────────────
interface SessionGuest {
  id: string;
  guest_id: string;
  guests: { id: string; name: string; is_active: boolean } | null;
}

interface GuestCandidate {
  id: string;
  name: string;
  phone: string | null;
  years_playing: number | null;
}

interface SessionGuestSectionProps {
  sessionId: string;
  /** true = 관리자 편집 모드 / false = 공개 읽기 전용 */
  editable?: boolean;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export function SessionGuestSection({ sessionId, editable = false }: SessionGuestSectionProps) {
  const [sessionGuests, setSessionGuests] = useState<SessionGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSessionGuests = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/session-guests?sessionId=${sessionId}`);
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) setSessionGuests(body.sessionGuests ?? []);
  }, [sessionId]);

  useEffect(() => { loadSessionGuests(); }, [loadSessionGuests]);

  async function handleRemove(sgId: string, guestName: string) {
    if (!confirm(`${guestName}을(를) 참석 게스트에서 제거할까요?`)) return;
    setRemovingId(sgId);
    const res = await fetch(`/api/admin/session-guests?id=${sgId}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) { toast.error("제거 실패"); return; }
    toast.success(`${guestName}이(가) 제거되었습니다.`);
    await loadSessionGuests();
  }

  async function handleAdd(guest: GuestCandidate) {
    const res = await fetch("/api/admin/session-guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, guestId: guest.id }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) { toast.error(body?.error ?? "추가 실패"); return; }
    toast.success(body.message);
    await loadSessionGuests();
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 py-3">
        <p className="text-[11px] text-[color:var(--surface-muted)]">게스트 참석자 불러오는 중...</p>
      </div>
    );
  }

  const addedIds = new Set(sessionGuests.map((sg) => sg.guest_id));

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[color:var(--surface-border)] px-4 py-2.5">
        <p className="text-[11px] font-semibold text-[color:var(--surface-muted)]">
          게스트 참석자
          {sessionGuests.length > 0 && (
            <span className="ml-1.5 text-[color:var(--surface-muted)]">({sessionGuests.length})</span>
          )}
        </p>
        {editable && !showAddPanel && (
          <button
            type="button"
            onClick={() => setShowAddPanel(true)}
            className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/20"
          >
            + 게스트 추가
          </button>
        )}
        {editable && showAddPanel && (
          <button
            type="button"
            onClick={() => setShowAddPanel(false)}
            className="rounded-sm border border-[color:var(--surface-border)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--surface-muted)]"
          >
            닫기
          </button>
        )}
      </div>

      {/* 현재 지정된 게스트 목록 */}
      {sessionGuests.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-sm text-[color:var(--surface-muted)]">지정된 게스트가 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--surface-border)]">
          {sessionGuests.map((sg) => {
            const name = sg.guests?.name ?? "알 수 없음";
            return (
              <div key={sg.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">{name}</p>
                  <span className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--surface-muted)]">
                    게스트
                  </span>
                </div>
                {editable && (
                  <button
                    type="button"
                    disabled={removingId === sg.id}
                    onClick={() => handleRemove(sg.id, name)}
                    className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)] hover:border-fault-400/60 hover:text-fault-400 disabled:opacity-40"
                  >
                    {removingId === sg.id ? "..." : "제거"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 게스트 추가 패널 — editable + showAddPanel */}
      {editable && showAddPanel && (
        <AddGuestPanel
          addedIds={addedIds}
          onAdd={async (guest) => { await handleAdd(guest); }}
        />
      )}
    </div>
  );
}

// ── 게스트 추가 패널 ─────────────────────────────────────────────
function AddGuestPanel({
  addedIds,
  onAdd,
}: {
  addedIds: Set<string>;
  onAdd: (guest: GuestCandidate) => Promise<void>;
}) {
  const [recentGuests, setRecentGuests] = useState<GuestCandidate[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // 최근 등록 게스트 10명 로드
  useEffect(() => {
    async function load() {
      setLoadingRecent(true);
      const res = await fetch("/api/admin/guests/recent");
      const body = await res.json().catch(() => null);
      setLoadingRecent(false);
      if (res.ok) setRecentGuests(body.guests ?? []);
    }
    load();
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/admin/guests/search?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json().catch(() => null);
    setSearching(false);
    if (res.ok) setSearchResults(body.guests ?? []);
  }

  async function doAdd(guest: GuestCandidate) {
    setAddingId(guest.id);
    await onAdd(guest);
    setAddingId(null);
    // 검색 결과에서도 제거
    setSearchResults((prev) => prev.filter((g) => g.id !== guest.id));
  }

  const inputCls = "h-9 flex-1 rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";

  return (
    <div className="border-t border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-4 pb-4 pt-3">
      {/* 최근 등록 게스트 */}
      <p className="mb-2 text-[10px] font-semibold text-[color:var(--surface-muted)]">최근 등록 게스트</p>
      {loadingRecent ? (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">불러오는 중...</p>
      ) : recentGuests.length === 0 ? (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">등록된 게스트가 없습니다.</p>
      ) : (
        <div className="mb-3 space-y-1">
          {recentGuests.map((g) => {
            const alreadyAdded = addedIds.has(g.id);
            return (
              <div key={g.id}
                className="flex items-center justify-between rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-3 py-2">
                <div className="min-w-0">
                  <span className="text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">{g.name}</span>
                  {g.years_playing != null && (
                    <span className="ml-1.5 text-[11px] text-[color:var(--surface-muted)]">구력 {g.years_playing}년</span>
                  )}
                </div>
                {alreadyAdded ? (
                  <span className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                    추가됨
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={addingId === g.id}
                    onClick={() => doAdd(g)}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                  >
                    {addingId === g.id ? "..." : "+ 추가"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 이름 검색 */}
      <p className="mb-2 text-[10px] font-semibold text-[color:var(--surface-muted)]">이름 검색</p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="게스트 이름 검색"
          className={inputCls}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="rounded-sm border border-[color:var(--surface-border)] px-3 text-xs font-semibold text-[color:var(--surface-muted)] disabled:opacity-40"
        >
          {searching ? "..." : "검색"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mt-2 space-y-1">
          {searchResults.map((g) => {
            const alreadyAdded = addedIds.has(g.id);
            return (
              <div key={g.id}
                className="flex items-center justify-between rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-3 py-2">
                <div>
                  <span className="text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">{g.name}</span>
                  {g.phone && <span className="ml-2 text-xs text-[color:var(--surface-muted)]">{g.phone}</span>}
                </div>
                {alreadyAdded ? (
                  <span className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                    추가됨
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={addingId === g.id}
                    onClick={() => doAdd(g)}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                  >
                    {addingId === g.id ? "..." : "+ 추가"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
