"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { timelineTypeLabel, formatTimelineDate } from "@/lib/constants/member-timeline";
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

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-line-600">🏆 대표 커리어</h2>
      <Card className="border-2 border-clay-400 p-3">
        <div className="flex items-center justify-between">
          <Badge tone="clay">{timelineTypeLabel(highlighted.timeline_type)}</Badge>
          <span className="text-xs text-line-400">
            {formatTimelineDate(highlighted.event_year, highlighted.event_month)}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-line-900">{highlighted.title}</p>
        {(highlighted.association || highlighted.division) && (
          <p className="mt-0.5 text-xs text-line-500">
            {[highlighted.association, highlighted.division].filter(Boolean).join(" · ")}
          </p>
        )}
      </Card>
    </section>
  );
}
