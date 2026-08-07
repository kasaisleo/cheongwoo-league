"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";

interface MemberCandidate {
  id: string;
  name: string;
  nickname: string;
  is_active: boolean;
}

interface GuestCandidate {
  id: string;
  name: string;
  phone: string | null;
}

interface AddEventParticipantSectionProps {
  eventId: string;
  /** 이미 활성(pending/confirmed) 참가자로 등록된 member/guest id — "추가됨"으로 표시만, 클릭 자체는 막지 않는다(막힌 이유는 서버 에러 메시지로 안내). */
  activeMemberIds: Set<string>;
  activeGuestIds: Set<string>;
  onAdded: () => void;
}

/**
 * AddEventParticipantSection — event_participants 수동 추가(0052 Phase 2A-4A).
 *
 * SessionGuestSection과 동일하게 모달이 아니라 인라인 확장 섹션. 회원/게스트
 * 탭으로 후보를 고르고 create_event_participant RPC(경유 API)만 호출한다 —
 * event_participants 직접 write 없음.
 */
export function AddEventParticipantSection({
  eventId,
  activeMemberIds,
  activeGuestIds,
  onAdded,
}: AddEventParticipantSectionProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"member" | "guest">("member");

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[11px] font-semibold text-[color:var(--surface-muted)]">참가자 추가</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2.5 py-1 text-[10px] font-semibold text-clay-400 hover:bg-clay-400/20"
        >
          {open ? "닫기" : "+ 추가"}
        </button>
      </div>

      {open && (
        <div className="border-t border-[color:var(--surface-border)] px-4 pb-4 pt-3">
          <div className="mb-3 flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab("member")}
              className={
                tab === "member"
                  ? "rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1 text-xs font-semibold text-clay-400"
                  : "rounded-sm border border-[color:var(--surface-border)] px-3 py-1 text-xs font-semibold text-[color:var(--surface-muted)]"
              }
            >
              회원
            </button>
            <button
              type="button"
              onClick={() => setTab("guest")}
              className={
                tab === "guest"
                  ? "rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1 text-xs font-semibold text-clay-400"
                  : "rounded-sm border border-[color:var(--surface-border)] px-3 py-1 text-xs font-semibold text-[color:var(--surface-muted)]"
              }
            >
              게스트
            </button>
          </div>

          {tab === "member" ? (
            <MemberPicker eventId={eventId} activeMemberIds={activeMemberIds} onAdded={onAdded} />
          ) : (
            <GuestPicker eventId={eventId} activeGuestIds={activeGuestIds} onAdded={onAdded} />
          )}
        </div>
      )}
    </div>
  );
}

async function postParticipant(
  eventId: string,
  body: { memberId?: string; guestId?: string }
): Promise<boolean> {
  const res = await fetch(`/api/admin/events/${eventId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json().catch(() => null);
  if (!res.ok) {
    toast.error(responseBody?.error ?? "추가에 실패했습니다.");
    return false;
  }
  toast.success("참가자가 추가되었습니다.");
  return true;
}

function MemberPicker({
  eventId,
  activeMemberIds,
  onAdded,
}: {
  eventId: string;
  activeMemberIds: Set<string>;
  onAdded: () => void;
}) {
  const [members, setMembers] = useState<MemberCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/members-list");
      const body = await res.json().catch(() => null);
      setLoading(false);
      if (res.ok) setMembers(body.members ?? []);
    }
    load();
  }, []);

  async function handleAdd(memberId: string) {
    setAddingId(memberId);
    const ok = await postParticipant(eventId, { memberId });
    setAddingId(null);
    if (ok) onAdded();
  }

  const filtered = members.filter(
    (m) =>
      !query.trim() ||
      m.name.includes(query.trim()) ||
      m.nickname.includes(query.trim())
  );

  const inputCls =
    "h-9 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";

  if (loading) {
    return <p className="text-xs text-[color:var(--surface-muted)]">회원 목록 불러오는 중...</p>;
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름/닉네임 검색"
        className={`${inputCls} mb-2`}
      />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-[color:var(--surface-muted)]">일치하는 회원이 없습니다.</p>
        ) : (
          filtered.map((m) => {
            const alreadyActive = activeMemberIds.has(m.id);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">
                    {m.nickname}
                  </span>
                  {!m.is_active && (
                    <span className="ml-1.5 text-[10px] font-semibold text-fault-400">비활성</span>
                  )}
                </div>
                {alreadyActive ? (
                  <span className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
                    참가중
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={addingId === m.id}
                    onClick={() => handleAdd(m.id)}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                  >
                    {addingId === m.id ? "..." : "+ 추가"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function GuestPicker({
  eventId,
  activeGuestIds,
  onAdded,
}: {
  eventId: string;
  activeGuestIds: Set<string>;
  onAdded: () => void;
}) {
  const [recentGuests, setRecentGuests] = useState<GuestCandidate[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

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

  async function handleAdd(guestId: string) {
    setAddingId(guestId);
    const ok = await postParticipant(eventId, { guestId });
    setAddingId(null);
    if (ok) {
      setSearchResults((prev) => prev.filter((g) => g.id !== guestId));
      onAdded();
    }
  }

  const inputCls =
    "h-9 flex-1 rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";

  function renderGuestRow(g: GuestCandidate) {
    const alreadyActive = activeGuestIds.has(g.id);
    return (
      <div
        key={g.id}
        className="flex items-center justify-between rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-bg)] px-3 py-2"
      >
        <div className="min-w-0">
          <span className="text-[15px] font-semibold leading-snug text-[color:var(--surface-text)]">{g.name}</span>
          {g.phone && <span className="ml-2 text-xs text-[color:var(--surface-muted)]">{g.phone}</span>}
        </div>
        {alreadyActive ? (
          <span className="rounded-sm border border-[color:var(--surface-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--surface-muted)]">
            참가중
          </span>
        ) : (
          <button
            type="button"
            disabled={addingId === g.id}
            onClick={() => handleAdd(g.id)}
            className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
          >
            {addingId === g.id ? "..." : "+ 추가"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold text-[color:var(--surface-muted)]">최근 등록 게스트</p>
      {loadingRecent ? (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">불러오는 중...</p>
      ) : recentGuests.length === 0 ? (
        <p className="mb-3 text-xs text-[color:var(--surface-muted)]">등록된 게스트가 없습니다.</p>
      ) : (
        <div className="mb-3 space-y-1">{recentGuests.map(renderGuestRow)}</div>
      )}

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

      {searchResults.length > 0 && <div className="mt-2 space-y-1">{searchResults.map(renderGuestRow)}</div>}
    </div>
  );
}
