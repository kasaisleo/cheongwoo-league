"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { timelineTypeLabel, formatTimelineDate } from "@/lib/constants/member-timeline";
import { getTimelineSchema } from "@/lib/timeline-schemas";
import { useMemberCareer } from "@/components/member/MemberCareerProvider";

/**
 * 회원 상세 "상단"(프로필 카드 다음)에 단독으로 배치하는 대표 커리어 카드.
 *
 * <MemberCareerProvider> 안에서만 쓸 수 있다 — useMemberCareer()가 그 context를
 * 구독해서 데이터를 가져온다. 자체적으로 fetch하지 않으므로 본문 목록
 * (MemberTimelineSection)과 항상 같은 데이터를 본다.
 *
 * 클릭하면 같은 항목의 수정 모달이 열린다(Provider가 소유한 단일 모달).
 * 모달에서 "대표 커리어로 표시"를 해제하고 저장하면, Provider의 items가
 * 갱신되면서 이 카드는 사라지고 본문 목록에 해당 항목이 다시 나타난다 —
 * 별도 refetch나 페이지 이동 없이 즉시 반영된다.
 */
export function MemberHighlightCareer() {
  const { highlighted, isAdmin, openEditModal } = useMemberCareer();

  if (!highlighted) return null;

  // title이 자동조립되는 종류(competition/league 등)는 협회/디비전이 이미
  // title 문자열 안에 녹아있다(예: "2022 홍천한우배 KATA 신인부 우승").
  // 그 경우 subtitle로 "KATA · 신인부"를 또 보여주면 같은 정보가 두 번
  // 반복되므로, 자동조립을 지원하지 않는 종류에서만 subtitle을 보여준다.
  const schema = getTimelineSchema(highlighted.timeline_type);
  const showSubtitle = !schema.supportsAutoTitle && (highlighted.association || highlighted.division);

  return (
    <section className="mb-4">
      <Card
        className={`overflow-hidden p-0 ${isAdmin ? "cursor-pointer" : ""}`}
        onClick={isAdmin ? () => openEditModal(highlighted) : undefined}
      >
        {/* "대표"는 이벤트 종류 배지가 아니라 이 카드 전체의 상태를 나타내는
            헤더 띠로 표현한다 — 일반 상태 배지(Badge)와 같은 모양이면 "대표"가
            종류 중 하나처럼 보여 혼동을 준다는 피드백을 반영했다. */}
        <div className="flex items-center gap-1.5 bg-clay-400 px-3 py-1.5">
          <span aria-hidden>🏆</span>
          <span className="text-xs font-bold uppercase tracking-widest text-line-25">대표 커리어</span>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <Badge tone="neutral">{timelineTypeLabel(highlighted.timeline_type)}</Badge>
            <span className="text-xs text-line-400">
              {formatTimelineDate(highlighted.event_year, highlighted.event_month)}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-line-900">{highlighted.title}</p>
          {showSubtitle && (
            <p className="mt-0.5 text-xs text-line-500">
              {[highlighted.association, highlighted.division].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}
