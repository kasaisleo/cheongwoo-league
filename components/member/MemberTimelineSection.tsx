"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EditTimelineModal } from "@/components/member/EditTimelineModal";
import { groupTimelineByYear, timelineTypeLabel } from "@/lib/constants/member-timeline";
import type { MemberTimeline } from "@/lib/supabase/database.types";

interface MemberTimelineSectionProps {
  memberId: string;
  isAdmin: boolean;
}

export function MemberTimelineSection({ memberId, isAdmin }: MemberTimelineSectionProps) {
  const [items, setItems] = useState<MemberTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MemberTimeline | null>(null);

  async function loadTimeline() {
    setLoading(true);
    const res = await fetch(`/api/members/timeline?memberId=${memberId}`);
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) {
      setItems(body.items ?? []);
    }
  }

  useEffect(() => {
    loadTimeline();
  }, [memberId]);

  const groups = groupTimelineByYear(items);

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-line-600">커리어 타임라인</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="text-xs font-semibold text-clay-400"
          >
            + 추가
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <Card className="p-4 text-center text-sm text-line-400">등록된 커리어 이력이 없습니다.</Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.year}>
              <p className="mb-1.5 text-sm font-bold text-line-900">{group.year}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <Card
                    key={item.id}
                    className={`p-3 ${isAdmin ? "cursor-pointer" : ""}`}
                    onClick={isAdmin ? () => setEditingItem(item) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={item.is_highlight ? "clay" : "neutral"}>
                          {timelineTypeLabel(item.timeline_type)}
                        </Badge>
                        {item.result && <Badge tone="court">{item.result}</Badge>}
                      </div>
                      <span className="text-xs text-line-400">{item.event_date ?? "날짜 미상"}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-line-900">{item.title}</p>
                    {(item.association || item.division) && (
                      <p className="mt-0.5 text-xs text-line-500">
                        {[item.association, item.division].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.memo && <p className="mt-1 text-xs text-line-400">{item.memo}</p>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <EditTimelineModal
          memberId={memberId}
          existing={null}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadTimeline();
          }}
        />
      )}

      {editingItem && (
        <EditTimelineModal
          memberId={memberId}
          existing={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            loadTimeline();
          }}
        />
      )}
    </section>
  );
}
