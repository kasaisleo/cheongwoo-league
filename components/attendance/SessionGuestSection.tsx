"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/components/ui/Toast";

interface SessionGuest {
  id: string;
  guest_id: string;
  guests: { id: string; name: string; phone: string | null; is_active: boolean } | null;
}

interface GuestCandidate {
  id: string;
  name: string;
  phone: string | null;
}

interface SessionGuestSectionProps {
  sessionId: string;
  /** true = 관리자 편집 모드, false = 공개 읽기 전용 */
  editable?: boolean;
}

/**
 * SessionGuestSection — 매치 참석 게스트 섹션.
 *
 * editable=true  → 관리자 /admin/attendance 전용. 게스트 추가/제거 가능.
 * editable=false → 공개 /attendance. 읽기 전용, 전화번호 미노출.
 */
export function SessionGuestSection({ sessionId, editable = false }: SessionGuestSectionProps) {
  const [sessionGuests, setSessionGuests] = useState<SessionGuest[]>([]);
  const [loading, setLoading] = useState(true);

  // 관리자 편집 전용 state
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GuestCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSessionGuests = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/session-guests?sessionId=${sessionId}`);
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) setSessionGuests(body.sessionGuests ?? []);
  }, [sessionId]);

  useEffect(() => { loadSessionGuests(); }, [loadSessionGuests]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    // 게스트 검색 — 활성, 미전환 게스트만
    const res = await fetch(`/api/admin/guests/search?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json().catch(() => null);
    setSearching(false);
    if (res.ok) {
      const addedIds = new Set(sessionGuests.map((sg) => sg.guest_id));
      setCandidates((body.guests ?? []).filter((g: GuestCandidate) => !addedIds.has(g.id)));
    }
  }

  async function handleAdd(guest: GuestCandidate) {
    setAddingId(guest.id);
    const res = await fetch("/api/admin/session-guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, guestId: guest.id }),
    });
    const body = await res.json().catch(() => null);
    setAddingId(null);
    if (!res.ok) { toast.error(body?.error ?? "추가 실패"); return; }
    toast.success(body.message);
    setCandidates((prev) => prev.filter((c) => c.id !== guest.id));
    await loadSessionGuests();
  }

  async function handleRemove(sgId: string, guestName: string) {
    if (!confirm(`${guestName}을(를) 참석 게스트에서 제거할까요?`)) return;
    setRemovingId(sgId);
    const res = await fetch(`/api/admin/session-guests?id=${sgId}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) { toast.error("제거 실패"); return; }
    toast.success(`${guestName}이(가) 제거되었습니다.`);
    await loadSessionGuests();
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3">
        <p className="text-[11px] text-line-400">게스트 참석자 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      <div className="border-b border-line-200/30 px-4 py-2.5">
        <p className="text-[11px] font-semibold text-line-500">
          게스트 참석자
          {sessionGuests.length > 0 && (
            <span className="ml-1.5 text-line-400">({sessionGuests.length})</span>
          )}
        </p>
      </div>

      {/* 현재 추가된 게스트 목록 */}
      {sessionGuests.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-sm text-line-400">지정된 게스트가 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-line-200/30">
          {sessionGuests.map((sg) => {
            const name = sg.guests?.name ?? "알 수 없음";
            return (
              <div key={sg.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-line-900">{name}</p>
                  <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
                    게스트
                  </span>
                </div>
                {editable && (
                  <button
                    type="button"
                    disabled={removingId === sg.id}
                    onClick={() => handleRemove(sg.id, name)}
                    className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-400 hover:border-fault-400/60 hover:text-fault-400 disabled:opacity-40"
                  >
                    {removingId === sg.id ? "..." : "제거"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 관리자 편집 — 게스트 검색 + 추가 */}
      {editable && (
        <div className="border-t border-line-200/30 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold text-line-500">게스트 검색 후 추가</p>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="게스트 이름 검색"
              className="h-9 flex-1 rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-600 disabled:opacity-40"
            >
              {searching ? "..." : "검색"}
            </button>
          </div>

          {candidates.length > 0 && (
            <div className="mt-2 space-y-1">
              {candidates.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-sm border border-line-200/40 bg-line-50 px-3 py-2">
                  <div>
                    <span className="text-sm font-semibold text-line-900">{g.name}</span>
                    {g.phone && (
                      <span className="ml-2 text-xs text-line-400">{g.phone}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={addingId === g.id}
                    onClick={() => handleAdd(g)}
                    className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                  >
                    {addingId === g.id ? "추가 중..." : "+ 추가"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
