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

  /**
   * PUT/POST가 성공하면 서버가 돌려준 최신 row를 받아 즉시 반영한다.
   * loadTimeline()의 GET 응답이 늦게 오거나 일시적으로 실패해도, 화면은
   * 이 시점부터 이미 정확한 값을 보여준다 — refetch는 그 뒤에 "진실 동기화"
   * 목적으로 한 번 더 호출하되, 화면 반영 자체는 이 함수가 보장한다.
   *
   * GET 응답과 동일한 정렬 기준(event_date desc, 없으면 created_at desc)을
   * 그대로 따른다 — groupTimelineByYear는 입력이 이미 정렬되어 있다고
   * 가정하므로, 여기서 순서가 흐트러지면 연도별 그룹이 깨질 수 있다.
   */
  function applySavedItem(saved: MemberTimeline) {
    setItems((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      const next = exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
      return [...next].sort((a, b) => {
        const aKey = a.event_date ?? "";
        const bKey = b.event_date ?? "";
        if (aKey !== bKey) {
          // event_date가 없는 항목(빈 문자열)은 맨 뒤로 — GET의
          // nullsFirst:false 정렬과 동일한 순서를 유지한다.
          if (!aKey) return 1;
          if (!bKey) return -1;
          return bKey.localeCompare(aKey);
        }
        return b.created_at.localeCompare(a.created_at);
      });
    });
  }

  useEffect(() => {
    loadTimeline();
  }, [memberId]);

  /** 삭제 성공 시 해당 id를 목록에서 즉시 제거한다(optimistic). */
  function removeDeletedItem(deletedId: string) {
    setItems((prev) => prev.filter((item) => item.id !== deletedId));
  }

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
          onSaved={(saved) => {
            setShowAddModal(false);
            applySavedItem(saved);
            loadTimeline();
          }}
          onDeleted={() => {
            // existing이 null인 추가 모달에는 삭제 버튼 자체가 없어 호출되지 않는다.
            setShowAddModal(false);
          }}
        />
      )}

      {editingItem && (
        <EditTimelineModal
          memberId={memberId}
          existing={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(saved) => {
            setEditingItem(null);
            applySavedItem(saved);
            loadTimeline();
          }}
          onDeleted={(deletedId) => {
            setEditingItem(null);
            removeDeletedItem(deletedId);
            loadTimeline();
          }}
        />
      )}
    </section>
  );
}
