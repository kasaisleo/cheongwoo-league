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
  /**
   * 저장(추가/수정) 성공 시 서버가 반환한 최신 row를 그대로 전달한다.
   * 부모가 이 값으로 목록을 즉시 갱신(optimistic)하면, 별도 GET refetch가
   * 늦게 도착하거나 실패하더라도 화면은 이미 최신 상태가 되어 있다.
   */
  onSaved: (saved: MemberTimeline) => void;
  /** 삭제 성공 시 호출. 저장과 결과 형태(반환되는 row가 없음)가 달라 분리했다. */
  onDeleted: (deletedId: string) => void;
}

function initialValues(existing: MemberTimeline | null): TimelineFormValues {
  return {
    eventYear: existing?.event_year != null ? String(existing.event_year) : "",
    eventMonth: existing?.event_month != null ? String(existing.event_month) : "",
    title: existing?.title ?? "",
    // competitionName/leagueName/role은 이제 title을 파싱해서 복원하지 않고
    // DB 원본 컬럼(competition_name/league_name/role)에서 그대로 가져온다 —
    // 이게 이 값들의 source of truth이고, title은 여기서 파생된 결과물이다.
    competitionName: existing?.competition_name ?? "",
    association: existing?.association ?? NO_ASSOCIATION,
    division: existing?.division ?? "",
    result: existing?.result ?? "",
    leagueName: existing?.league_name ?? "",
    role: existing?.role ?? "",
    memo: existing?.memo ?? "",
    isHighlight: existing?.is_highlight ?? false,
  };
}

export function EditTimelineModal({ memberId, existing, onClose, onSaved, onDeleted }: EditTimelineModalProps) {
  // 기존 row가 legacy 값(achievement/attendance)을 갖고 있을 수 있어 초기값은
  // AnyTimelineType으로 받는다. 사용자가 버튼을 눌러 종류를 바꾸면 신규 값만
  // 선택 가능하므로, 그 시점부터는 자연스럽게 신규 값으로 좁혀진다.
  const [timelineType, setTimelineType] = useState<AnyTimelineType>(
    (existing?.timeline_type as AnyTimelineType) ?? "competition"
  );
  const [values, setValues] = useState<TimelineFormValues>(() => initialValues(existing));
  // title 자동생성 on/off. add든 edit이든 항상 "auto"로 시작한다 — "기존
  // title이 자동조립 규칙과 일치하는가"로 추측하는 방식은 쓰지 않는다. 그
  // 추측은 필드가 바뀌는 순간 거의 항상 불일치로 판정되어버리는 근본적
  // 결함이 있었다(연도를 2024→2027로 바꾸면 "2024 ..."였던 title은 새
  // 필드값 기준 재계산과 당연히 달라지므로, 그게 "원래 수동입력이었다"는
  // 뜻이 아니다).
  //
  // 대신 manual 전환은 오직 "직접 수정" 버튼 클릭(handleSwitchToManualTitle)
  // 이라는 명시적 행동으로만 일어난다 — 그래서 auto/manual 여부가 항상
  // 명확하다. supportsAutoTitle이 false인 종류(join/custom 등)는 처음부터
  // 자유 입력 필드로 보여주므로 이 모드 구분 자체가 화면에 노출되지 않는다.
  const [titleMode, setTitleMode] = useState<"auto" | "manual">("auto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLegacySelected = isLegacyTimelineType(timelineType);
  const schema = useMemo(() => getTimelineSchema(timelineType), [timelineType]);

  function updateValues(patch: Partial<TimelineFormValues>) {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      // patch에 title이 직접 들어있으면(manual 모드의 title 입력칸에서만
      // 발생) 그 값을 최종으로 보고 buildTitle로 덮어쓰지 않는다 — 안전망.
      const isDirectTitleEdit = Object.prototype.hasOwnProperty.call(patch, "title");
      if (titleMode === "auto" && !isDirectTitleEdit) {
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
      // 종류가 바뀌면 그 종류 전용 재료(대회명/리그명/직책)는 의미가 없어지므로
      // 초기화한다. eventYear/eventMonth/association/division/result/memo는
      // career ↔ competition처럼 종류 간에도 의미가 통하는 경우가 많아 그대로 유지한다.
      const reset = { ...prev, competitionName: "", leagueName: "", role: "" };
      // setTimelineType과 setValues가 같은 렌더에서 batching되더라도 title이 한 텀
      // 늦게 갱신되지 않도록, 새 종류의 schema로 즉시 title을 다시 계산한다.
      const nextSchema = getTimelineSchema(nextType);
      const autoTitle = nextSchema.buildTitle(reset);
      return autoTitle !== null ? { ...reset, title: autoTitle } : { ...reset, title: "" };
    });
  }

  /** "직접 수정" 버튼 클릭 시 호출 — 이 명시적 행동으로만 manual로 전환된다. */
  function handleSwitchToManualTitle() {
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
    onDeleted(existing.id);
  }

  async function handleSubmit() {
    if (!values.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    // existing이 있는데 id가 비어있는 경우(이론상 발생하면 안 되지만, 발생하면
    // PUT이 잘못된 URL로 나가 조용히 실패할 수 있어 사전에 막는다).
    if (existing && !existing.id) {
      toast.error("수정할 항목 정보를 찾을 수 없습니다. 모달을 닫고 다시 시도해주세요.");
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
    // competitionName/leagueName/role도 이제 DB에 저장되는 원본 컬럼이라
    // 같은 원칙을 적용한다 — 화면에 그 필드가 없는 종류라면 null로 보낸다.
    const competitionName = fieldSet.has("competitionName") && values.competitionName.trim()
      ? values.competitionName.trim()
      : null;
    const leagueName = fieldSet.has("leagueName") && values.leagueName.trim() ? values.leagueName.trim() : null;
    const role = fieldSet.has("role") && values.role.trim() ? values.role.trim() : null;

    // eventYear가 비어있으면 "날짜 전체 모름"이고, 이 경우 eventMonth도 항상
    // null로 보낸다(연도 없이 월만 있는 입력은 의미가 모호해 서버 validation도
    // 막고 있다 — 여기서도 같은 규칙을 지켜 굳이 거부당할 요청을 만들지 않는다).
    const eventYear = values.eventYear ? Number(values.eventYear) : null;
    const eventMonth = eventYear && values.eventMonth ? Number(values.eventMonth) : null;

    const payload = {
      memberId,
      timelineType,
      eventYear,
      eventMonth,
      title: values.title.trim(),
      competitionName,
      leagueName,
      role,
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

    if (!body?.item) {
      // 서버가 200을 줬는데 item이 없는 비정상 응답. 화면을 잘못된 상태로
      // 두지 않기 위해 명확한 에러로 처리한다(조용히 성공 처리하지 않음).
      const message = "저장은 되었지만 서버 응답을 확인할 수 없습니다. 목록을 새로고침해주세요.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(existing ? "타임라인 항목이 수정되었습니다." : "타임라인 항목이 추가되었습니다.");
    onSaved(body.item as MemberTimeline);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-bg-raised)] p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wide text-clay-400">
            {existing ? "타임라인 수정" : "타임라인 추가"}
          </p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-[color:var(--surface-muted)]">
            닫기
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--surface-muted)]">종류</label>
            {isLegacySelected && (
              <p className="mb-1.5 text-xs text-[color:var(--surface-muted)]">
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
                      ? "border-[color:var(--control-selected-bg)] bg-[color:var(--control-selected-bg)] text-[color:var(--control-selected-text)]"
                      : "border-[color:var(--control-border)] text-[color:var(--control-placeholder)]"
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
              titleIsAutoGenerated={schema.supportsAutoTitle}
              titleMode={titleMode}
              onSwitchToManualTitle={handleSwitchToManualTitle}
            />
          ))}

          <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--surface-muted)]">
            <input
              type="checkbox"
              checked={values.isHighlight}
              onChange={(e) => updateValues({ isHighlight: e.target.checked })}
              style={{ accentColor: "var(--control-selected-bg)" }}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--control-focus-ring)]"
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
