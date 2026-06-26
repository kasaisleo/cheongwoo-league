"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/Toast";
import {
  TIMELINE_TYPE_OPTIONS,
  isLegacyTimelineType,
  timelineTypeLabel,
  type AnyTimelineType,
} from "@/lib/constants/member-timeline";
import { NO_ASSOCIATION, getTimelineSchema, type TimelineFormValues } from "@/lib/timeline-schemas";
import { TimelineFieldRenderer } from "@/components/member/TimelineFieldRenderer";
import type { MemberTimeline } from "@/lib/supabase/database.types";

interface EditTimelineModalProps {
  memberId: string;
  /** 수정 모드면 기존 항목, 추가 모드면 null */
  existing: MemberTimeline | null;
  onClose: () => void;
  onSaved: () => void;
}

function initialValues(existing: MemberTimeline | null): TimelineFormValues {
  return {
    eventDate: existing?.event_date ?? "",
    title: existing?.title ?? "",
    competitionName: "",
    association: existing?.association ?? NO_ASSOCIATION,
    division: existing?.division ?? "",
    result: existing?.result ?? "",
    leagueName: "",
    seasonYear: "",
    role: "",
    memo: existing?.memo ?? "",
    isHighlight: existing?.is_highlight ?? false,
  };
}

export function EditTimelineModal({ memberId, existing, onClose, onSaved }: EditTimelineModalProps) {
  // 기존 row가 legacy 값(achievement/attendance)을 갖고 있을 수 있어 초기값은
  // AnyTimelineType으로 받는다. 사용자가 버튼을 눌러 종류를 바꾸면 신규 값만
  // 선택 가능하므로, 그 시점부터는 자연스럽게 신규 값으로 좁혀진다.
  const [timelineType, setTimelineType] = useState<AnyTimelineType>(
    (existing?.timeline_type as AnyTimelineType) ?? "competition"
  );
  const [values, setValues] = useState<TimelineFormValues>(() => initialValues(existing));
  // title 자동생성 on/off. 기존 항목을 수정할 때는 이미 저장된 title을
  // 덮어쓰지 않기 위해 항상 manual로 시작하고, 신규 추가일 때만 auto로 시작한다.
  const [titleMode, setTitleMode] = useState<"auto" | "manual">(existing ? "manual" : "auto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLegacySelected = isLegacyTimelineType(timelineType);
  const schema = useMemo(() => getTimelineSchema(timelineType), [timelineType]);

  function updateValues(patch: Partial<TimelineFormValues>) {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      if (titleMode === "auto") {
        const autoTitle = schema.buildTitle(next);
        if (autoTitle !== null) {
          next.title = autoTitle;
        }
      }
      return next;
    });
  }

  function handleTimelineTypeChange(nextType: AnyTimelineType) {
    setTimelineType(nextType);
    setTitleMode("auto");
    setValues((prev) => {
      // 종류가 바뀌면 그 종류 전용 재료(대회명/리그명/시즌/직책)는 의미가 없어지므로
      // 초기화한다. association/division/result/memo/날짜는 career ↔ competition처럼
      // 종류 간에도 의미가 통하는 경우가 많아 그대로 유지한다.
      const reset = { ...prev, competitionName: "", leagueName: "", seasonYear: "", role: "" };
      // setTimelineType과 setValues가 같은 렌더에서 batching되더라도 title이 한 텀
      // 늦게 갱신되지 않도록, 새 종류의 schema로 즉시 title을 다시 계산한다.
      const nextSchema = getTimelineSchema(nextType);
      const autoTitle = nextSchema.buildTitle(reset);
      return autoTitle !== null ? { ...reset, title: autoTitle } : { ...reset, title: "" };
    });
  }

  function handleTitleManualEdit() {
    setTitleMode("manual");
  }

  const isAssociationSelected = values.association !== NO_ASSOCIATION;

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
    if (!values.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // schema.fields에 association/division/result가 없는 종류(join/league/system/custom
    // 등)라도, 만약 기존 값이 남아있다면 그대로 보존하지 않고 정직하게 비워서 보낸다 —
    // 화면에 보이지 않는 필드는 저장도 되지 않아야 "보이는 대로 저장된다"는 원칙이 유지된다.
    const fieldSet = new Set(schema.fields);
    const association = fieldSet.has("association") && isAssociationSelected ? values.association : null;
    const division = fieldSet.has("division") && values.division ? values.division : null;
    const result = fieldSet.has("result") && values.result ? values.result : null;

    const payload = {
      memberId,
      timelineType,
      eventDate: values.eventDate.trim() || null,
      title: values.title.trim(),
      association,
      division,
      result,
      memo: values.memo.trim() || null,
      isHighlight: values.isHighlight,
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
                  onClick={() => handleTimelineTypeChange(option.value)}
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

          {schema.fields.map((field) => (
            <TimelineFieldRenderer
              key={field}
              field={field}
              values={values}
              onChange={updateValues}
              titlePlaceholder={schema.titlePlaceholder}
              onTitleManualEdit={handleTitleManualEdit}
            />
          ))}

          <label className="flex items-center gap-2 text-xs font-semibold text-line-600">
            <input
              type="checkbox"
              checked={values.isHighlight}
              onChange={(e) => updateValues({ isHighlight: e.target.checked })}
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
