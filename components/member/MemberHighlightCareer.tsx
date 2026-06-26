"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { timelineTypeLabel, formatTimelineDate } from "@/lib/constants/member-timeline";
import { getTimelineSchema } from "@/lib/timeline-schemas";
import type { MemberTimeline } from "@/lib/supabase/database.types";

interface MemberHighlightCareerProps {
  memberId: string;
}

/**
 * 회원 상세 "상단"에 단독으로 배치하는 대표 커리어 카드.
 *
 * MemberTimelineSection(본문 목록, 최근 경기 다음 위치)과는 별개의 클라이언트
 * 컴포넌트다 — 대표 커리어는 상단에, 본문 정렬·위치는 그대로 유지해야 해서
 * 한 컴포넌트로 합치면 화면 배치가 요구사항과 어긋난다.
 *
 * 두 컴포넌트가 각자 GET /api/members/timeline을 호출하므로 완벽한 단일
 * source-of-truth는 아니지만, 둘 다 같은 응답을 받고 거의 동시에 갱신되며
 * "누가 대표인지"는 서버(ensureSingleHighlight)가 항상 단일하게 보장하므로
 * 새로고침하면 항상 일치한다. 완전한 상태 공유(부모로 끌어올리기)는 이
 * 페이지가 서버 컴포넌트라 적용하기 까다로워 이 정도 절충으로 처리한다.
 */
export function MemberHighlightCareer({ memberId }: MemberHighlightCareerProps) {
  const [highlighted, setHighlighted] = useState<MemberTimeline | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/members/timeline?memberId=${memberId}`);
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      if (res.ok) {
        const items = (body.items ?? []) as MemberTimeline[];
        setHighlighted(items.find((item) => item.is_highlight) ?? null);
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  // 로딩 중이거나 대표 커리어가 없으면 영역 자체를 숨긴다(레이아웃 깜빡임 방지를
  // 위해 로딩 중에도 아무것도 그리지 않는다 — 스켈레톤보다 깜빡임 없는 게 낫다).
  if (!loaded || !highlighted) return null;

  // title이 자동조립되는 종류(competition/league 등)는 협회/디비전이 이미
  // title 문자열 안에 녹아있다(예: "2022 홍천한우배 KATA 신인부 우승").
  // 그 경우 subtitle로 "KATA · 신인부"를 또 보여주면 같은 정보가 두 번
  // 반복되므로, 자동조립을 지원하지 않는 종류(legacy/join/custom)에서만
  // subtitle을 보여준다 — 그 종류들은 title에 협회/디비전이 안 들어있을
  // 수 있어 subtitle이 유의미한 보조 정보가 된다.
  const schema = getTimelineSchema(highlighted.timeline_type);
  const showSubtitle = !schema.supportsAutoTitle && (highlighted.association || highlighted.division);

  return (
    <section className="mb-4">
      <Card className="overflow-hidden p-0">
        {/* "대표"는 이벤트 종류 배지가 아니라 이 카드 전체의 상태를 나타내는
            헤더 띠로 표현한다 — Badge 컴포넌트(다른 상태 배지들과 같은 모양)를
            쓰면 "대표"가 종류 중 하나처럼 보여 혼동을 준다는 피드백을 반영했다. */}
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
