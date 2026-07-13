"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import type { Member } from "@/lib/supabase/database.types";

interface Props {
  guestId: string;
  guestName: string;
  guestPhone: string | null;
  guestAge: number | null;
  guestYearsPlaying: number | null;
  guestReferredBy: string | null;
  guestNotes: string | null;
  guestVisitDate: string;
  canEdit: boolean;
  canDeactivate: boolean;
}

/**
 * GuestAdminActions — 관리자 전용 게스트 수정/비활성화 버튼.
 * 권한 판단은 서버(GuestList)에서 props로 전달.
 */
export function GuestAdminActions({
  guestId,
  guestName,
  guestPhone,
  guestAge,
  guestYearsPlaying,
  guestReferredBy,
  guestNotes,
  guestVisitDate,
  canEdit,
  canDeactivate,
}: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleDeactivate() {
    setDeactivating(true);
    setConfirming(false);
    const res = await fetch(`/api/guests/${guestId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeactivating(false);
    if (!res.ok) { toast.error(body?.error ?? "비활성화에 실패했습니다."); return; }
    toast.success(`${guestName}이(가) 비활성화되었습니다.`);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400"
          >
            수정
          </button>
        )}
        {canDeactivate && !confirming && (
          <button
            type="button"
            disabled={deactivating}
            onClick={() => setConfirming(true)}
            className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-400 hover:border-fault-400/60 hover:text-fault-400 disabled:opacity-40"
          >
            비활성화
          </button>
        )}
        {confirming && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-line-500">비활성화할까요?</span>
            <button type="button" disabled={deactivating} onClick={handleDeactivate}
              className="rounded-sm border border-fault-400/60 bg-fault-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-fault-400 disabled:opacity-40">
              {deactivating ? "..." : "확인"}
            </button>
            <button type="button" onClick={() => setConfirming(false)}
              className="rounded-sm border border-line-200/40 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
              취소
            </button>
          </div>
        )}
      </div>

      {showEdit && (
        <GuestEditModal
          guestId={guestId}
          initialName={guestName}
          initialPhone={guestPhone ?? ""}
          initialAge={guestAge?.toString() ?? ""}
          initialYearsPlaying={guestYearsPlaying?.toString() ?? ""}
          initialNotes={guestNotes ?? ""}
          initialVisitDate={guestVisitDate}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); router.refresh(); }}
        />
      )}
    </>
  );
}

// ── 수정 모달 ────────────────────────────────────────────────────────
function GuestEditModal({
  guestId,
  initialName,
  initialPhone,
  initialAge,
  initialYearsPlaying,
  initialNotes,
  initialVisitDate,
  onClose,
  onSaved,
}: {
  guestId: string;
  initialName: string;
  initialPhone: string;
  initialAge: string;
  initialYearsPlaying: string;
  initialNotes: string;
  initialVisitDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]                   = useState(initialName);
  const [phone, setPhone]                 = useState(initialPhone);
  const [age, setAge]                     = useState(initialAge);
  const [yearsPlaying, setYearsPlaying]   = useState(initialYearsPlaying);
  const [notes, setNotes]                 = useState(initialNotes);
  const [visitDate, setVisitDate]         = useState(initialVisitDate);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const inputCls = "h-10 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]";
  const labelCls = "mb-1 block text-xs font-semibold text-line-600";

  async function handleSave() {
    const normalized = name.replace(/\s+/g, "").trim();
    if (!normalized) { setError("이름을 입력해주세요."); return; }
    setSubmitting(true); setError(null);

    const res = await fetch(`/api/guests/${guestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: normalized,
        phone: phone.trim() || null,
        age: age.trim() ? Number(age) : null,
        years_playing: yearsPlaying.trim() ? Number(yearsPlaying) : null,
        notes: notes.trim() || null,
        visit_date: visitDate,
      }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) { setError(body?.error ?? "수정에 실패했습니다."); return; }
    toast.success("게스트 정보가 수정되었습니다.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[14px] border border-line-200/40 bg-line-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-clay-400">게스트 수정</p>
          <button type="button" onClick={onClose}
            className="text-xs font-semibold text-line-500 hover:text-line-700">닫기</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>이름 <span className="text-fault-400">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>방문 날짜</label>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>전화번호</label>
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>나이</label>
              <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="예: 35" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>구력 (년)</label>
              <input type="number" inputMode="decimal" step="0.5" value={yearsPlaying} onChange={(e) => setYearsPlaying(e.target.value)} placeholder="예: 3.5" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>메모</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full resize-none rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 py-2 text-sm text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]" />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <button type="button" disabled={submitting} onClick={handleSave}
          className="mt-4 h-12 w-full rounded-sm bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40">
          {submitting ? "저장 중..." : "수정 저장"}
        </button>
      </div>
    </div>
  );
}
