"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import {
  TIMELINE_TYPE_OPTIONS,
  ASSOCIATION_OPTIONS,
  RESULT_OPTIONS,
  divisionOptionsFor,
  associationHasNoDivision,
  isLegacyTimelineType,
  timelineTypeLabel,
  type AnyTimelineType,
} from "@/lib/constants/member-timeline";
import type { MemberTimeline } from "@/lib/supabase/database.types";

interface EditTimelineModalProps {
  memberId: string;
  /** 수정 모드면 기존 항목, 추가 모드면 null */
  existing: MemberTimeline | null;
  onClose: () => void;
  onSaved: () => void;
}

const NO_ASSOCIATION = "__none__";

export function EditTimelineModal({ memberId, existing, onClose, onSaved }: EditTimelineModalProps) {
  // 기존 row가 legacy 값(achievement/attendance)을 갖고 있을 수 있어 초기값은
  // AnyTimelineType으로 받는다. 사용자가 버튼을 눌러 종류를 바꾸면 신규 값(TimelineType)만
  // 선택 가능하므로, 그 시점부터는 자연스럽게 신규 값으로 좁혀진다.
  const [timelineType, setTimelineType] = useState<AnyTimelineType>(
    (existing?.timeline_type as AnyTimelineType) ?? "competition"
  );
  const isLegacySelected = isLegacyTimelineType(timelineType);
  const [eventDate, setEventDate] = useState(existing?.event_date ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [association, setAssociation] = useState<string>(existing?.association ?? NO_ASSOCIATION);
  const [division, setDivision] = useState<string>(existing?.division ?? "");
  const [result, setResult] = useState<string>(existing?.result ?? "");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [isHighlight, setIsHighlight] = useState(existing?.is_highlight ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAssociationSelected = association !== NO_ASSOCIATION;
  const divisionOptions = isAssociationSelected ? divisionOptionsFor(association) : [];
  const showDivisionSelect = isAssociationSelected && !associationHasNoDivision(association);

  function handleAssociationChange(value: string) {
    setAssociation(value);
    setDivision(""); // association이 바뀌면 division 선택은 항상 초기화
  }

  async function handleDelete() {
    if (!existing) return;
    const confirmed = window.confirm("이 타임라인 항목을 삭제하시겠습니까?");
    if (!confirmed) return;

    setSubmitting(true);
    const res = await fetch(`/api/members/timeline/${existing.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "삭제에 실패했습니다.");
      return;
    }

    toast.success("타임라인 항목이 삭제되었습니다.");
    onSaved();
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      memberId,
      timelineType,
      eventDate: eventDate.trim() || null,
      title: title.trim(),
      association: isAssociationSelected ? association : null,
      division: showDivisionSelect && division ? division : null,
      result: result || null,
      memo: memo.trim() || null,
      isHighlight,
    };

    const res = existing
      ? await fetch(`/api/members/timeline/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/members/timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      const message = body?.error ?? "저장에 실패했습니다.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(existing ? "타임라인 항목이 수정되었습니다." : "타임라인 항목이 추가되었습니다.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-line-200 bg-line-100 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wide text-clay-400">
            {existing ? "타임라인 수정" : "타임라인 추가"}
          </p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-line-500">
            닫기
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">종류</label>
            {isLegacySelected && (
              <p className="mb-1.5 text-xs text-line-500">
                현재 값: <span className="font-semibold">{timelineTypeLabel(timelineType)}</span> (이전 방식으로
                저장된 항목입니다. 아래에서 새 종류를 선택하면 변경됩니다)
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {TIMELINE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTimelineType(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    timelineType === option.value
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">
              날짜 (모르면 비워두세요 — "날짜 미상"으로 표시됩니다)
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2025 강서오픈, 청우회 가입"
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">대회 구분 (대회 이력이 아니면 비워두세요)</label>
            <select
              value={association}
              onChange={(e) => handleAssociationChange(e.target.value)}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            >
              <option value={NO_ASSOCIATION}>선택 안 함</option>
              {ASSOCIATION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {showDivisionSelect && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">부서</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
              >
                <option value="">선택 안 함</option>
                {divisionOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isAssociationSelected && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-line-600">결과</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
              >
                <option value="">선택 안 함</option>
                {RESULT_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="예: 복식, 파트너 홍길동"
              className="box-border block w-full min-w-0 max-w-full resize-none rounded-lg border border-line-200 bg-line-25 px-3 py-2 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-line-600">
            <input
              type="checkbox"
              checked={isHighlight}
              onChange={(e) => setIsHighlight(e.target.checked)}
            />
            대표 커리어로 표시
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-4 h-12 w-full rounded-lg bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
        >
          {submitting ? "저장 중..." : existing ? "수정 내용 저장" : "타임라인 추가"}
        </button>

        {existing && (
          <button
            type="button"
            disabled={submitting}
            onClick={handleDelete}
            className="mt-2 h-10 w-full rounded-lg border border-fault-400 text-xs font-semibold text-fault-400 disabled:opacity-40"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
