"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { groupTimelineByYear, timelineTypeLabel, formatTimelineDate } from "@/lib/constants/member-timeline";
import { getTimelineSchema } from "@/lib/timeline-schemas";
import { useMemberCareer } from "@/components/member/MemberCareerProvider";

/**
 * "커리어 타임라인" 본문 목록(회원 상세, 최근 경기 다음 위치).
 *
 * <MemberCareerProvider> 안에서만 쓸 수 있다 — useMemberCareer()가 그 context를
 * 구독해서 데이터를 가져온다. 자체적으로 fetch하지 않으므로 상단 대표 커리어
 * 카드(MemberHighlightCareer)와 항상 같은 데이터를 본다.
 *
 * 정책: isHighlight=true인 항목은 이 목록에 표시하지 않는다(대표 커리어
 * 영역에만 노출). bodyItems는 Provider가 이미 그 필터를 적용해서 내려준다 —
 * 대표가 해제되면 다음 렌더에서 자동으로 여기에 다시 나타난다.
 */
export function MemberTimelineSection() {
  const { bodyItems, loading, isAdmin, openAddModal, openEditModal } = useMemberCareer();
  const groups = groupTimelineByYear(bodyItems);

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">커리어 타임라인</h2>
        {isAdmin && (
          <button type="button" onClick={openAddModal} className="text-xs font-semibold text-clay-400">
            + 추가
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : bodyItems.length === 0 ? (
        <Card className="p-4 text-center text-sm text-line-400">등록된 커리어 이력이 없습니다.</Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.year}>
              <p className="mb-1.5 text-sm font-bold text-line-900">{group.year}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const itemSchema = getTimelineSchema(item.timeline_type);
                  // 상단 MemberHighlightCareer와 동일한 기준: title이 자동조립되는
                  // 종류는 협회/디비전이 이미 title 문자열에 들어있어 subtitle로
                  // 또 보여주면 중복된다.
                  const showSubtitle = !itemSchema.supportsAutoTitle && (item.association || item.division);
                  return (
                    <Card
                      key={item.id}
                      className={`p-3 ${isAdmin ? "cursor-pointer" : ""}`}
                      onClick={isAdmin ? () => openEditModal(item) : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge tone="neutral">{timelineTypeLabel(item.timeline_type)}</Badge>
                          {item.result && <Badge tone="court">{item.result}</Badge>}
                        </div>
                        <span className="text-xs text-line-400">
                          {formatTimelineDate(item.event_year, item.event_month)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-line-900">{item.title}</p>
                      {showSubtitle && (
                        <p className="mt-0.5 text-xs text-line-500">
                          {[item.association, item.division].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {item.memo && <p className="mt-1 text-xs text-line-400">{item.memo}</p>}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
