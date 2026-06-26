"use client";

import {
  ASSOCIATION_OPTIONS,
  RESULT_OPTIONS,
  divisionOptionsFor,
  associationHasNoDivision,
} from "@/lib/constants/member-timeline";
import { NO_ASSOCIATION, type TimelineFieldKey, type TimelineFormValues } from "@/lib/timeline-schemas";

interface TimelineFieldRendererProps {
  field: TimelineFieldKey;
  values: TimelineFormValues;
  /** 필드 하나를 갱신. division처럼 association 변경 시 함께 초기화해야 하는
   * 경우가 있어 단일 key/value가 아니라 patch(부분 객체)를 받는다. */
  onChange: (patch: Partial<TimelineFormValues>) => void;
  titlePlaceholder: string;
  /** title을 사용자가 직접 입력하면 자동생성을 멈춰야 하므로 별도로 알린다. */
  onTitleManualEdit: () => void;
}

const inputClass =
  "box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400";
const selectClass = "h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900";
const labelClass = "mb-1 block text-xs font-semibold text-line-600";

/** 연도 드롭다운 옵션: 올해 기준 -1년 ~ +1년. 운영 중 시즌이 걸쳐있을 수 있어 약간의 여유를 둔다. */
function seasonYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [currentYear + 1, currentYear, currentYear - 1].map(String);
}

/**
 * schema.fields 배열의 한 항목을 실제 입력 UI로 렌더링한다.
 * 새 필드 종류가 추가되면 이 switch에 한 case만 추가하면 된다 — timeline_type
 * 자체의 분기(switch)는 schema 파일들로 옮겨졌고, 여기 남은 분기는 "필드
 * 종류 → 입력 위젯" 매핑이라 종류가 늘어도 폭발적으로 커지지 않는다.
 */
export function TimelineFieldRenderer({
  field,
  values,
  onChange,
  titlePlaceholder,
  onTitleManualEdit,
}: TimelineFieldRendererProps) {
  switch (field) {
    case "eventDate":
      return (
        <div>
          <label className={labelClass}>날짜 (모르면 비워두세요 — &quot;날짜 미상&quot;으로 표시됩니다)</label>
          <input
            type="date"
            value={values.eventDate}
            onChange={(e) => onChange({ eventDate: e.target.value })}
            className={inputClass}
          />
        </div>
      );

    case "title":
      return (
        <div>
          <label className={labelClass}>제목 *</label>
          <input
            value={values.title}
            onChange={(e) => {
              onTitleManualEdit();
              onChange({ title: e.target.value });
            }}
            placeholder={titlePlaceholder}
            className={inputClass}
          />
        </div>
      );

    case "competitionName":
      return (
        <div>
          <label className={labelClass}>대회명</label>
          <input
            value={values.competitionName}
            onChange={(e) => onChange({ competitionName: e.target.value })}
            placeholder="예: 2025 강서오픈"
            className={inputClass}
          />
        </div>
      );

    case "association": {
      const isSelected = values.association !== NO_ASSOCIATION;
      return (
        <div>
          <label className={labelClass}>협회</label>
          <select
            value={values.association}
            onChange={(e) =>
              // association이 바뀌면 division은 항상 초기화 (이전 association의
              // division 목록에 속한 값이 새 association에서는 무효일 수 있음).
              onChange({ association: e.target.value, division: "" })
            }
            className={selectClass}
          >
            <option value={NO_ASSOCIATION}>선택 안 함</option>
            {ASSOCIATION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {!isSelected && <p className="mt-1 text-xs text-line-400">협회를 선택하면 디비전/결과를 고를 수 있어요.</p>}
        </div>
      );
    }

    case "division": {
      const isAssociationSelected = values.association !== NO_ASSOCIATION;
      if (!isAssociationSelected || associationHasNoDivision(values.association)) return null;
      const divisionOptions = divisionOptionsFor(values.association);
      return (
        <div>
          <label className={labelClass}>디비전</label>
          <select value={values.division} onChange={(e) => onChange({ division: e.target.value })} className={selectClass}>
            <option value="">선택 안 함</option>
            {divisionOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case "result":
      return (
        <div>
          <label className={labelClass}>결과</label>
          <select value={values.result} onChange={(e) => onChange({ result: e.target.value })} className={selectClass}>
            <option value="">선택 안 함</option>
            {RESULT_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      );

    case "leagueName":
      return (
        <div>
          <label className={labelClass}>리그명</label>
          <input
            value={values.leagueName}
            onChange={(e) => onChange({ leagueName: e.target.value })}
            placeholder="예: 청우회 리그"
            className={inputClass}
          />
        </div>
      );

    case "seasonYear":
      return (
        <div>
          <label className={labelClass}>시즌</label>
          <select value={values.seasonYear} onChange={(e) => onChange({ seasonYear: e.target.value })} className={selectClass}>
            <option value="">선택 안 함</option>
            {seasonYearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      );

    case "role":
      return (
        <div>
          <label className={labelClass}>직책</label>
          <input
            value={values.role}
            onChange={(e) => onChange({ role: e.target.value })}
            placeholder="예: 총무"
            className={inputClass}
          />
        </div>
      );

    case "memo":
      return (
        <div>
          <label className={labelClass}>메모</label>
          <textarea
            value={values.memo}
            onChange={(e) => onChange({ memo: e.target.value })}
            rows={2}
            placeholder="예: 복식, 파트너 홍길동"
            className="box-border block w-full min-w-0 max-w-full resize-none rounded-lg border border-line-200 bg-line-25 px-3 py-2 text-sm text-line-900 placeholder:text-line-400"
          />
        </div>
      );

    default:
      return null;
  }
}
