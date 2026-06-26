"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EditTimelineModal } from "@/components/member/EditTimelineModal";
import type { MemberTimeline } from "@/lib/supabase/database.types";

interface MemberCareerContextValue {
  items: MemberTimeline[];
  loading: boolean;
  isAdmin: boolean;
  /** 대표 커리어(없으면 null). items에서 매번 파생되므로 항상 최신이다. */
  highlighted: MemberTimeline | null;
  /** isHighlight=true 항목을 제외한 본문 목록 — 대표 카드와 중복 노출되지 않는다. */
  bodyItems: MemberTimeline[];
  openAddModal: () => void;
  openEditModal: (item: MemberTimeline) => void;
}

const MemberCareerContext = createContext<MemberCareerContextValue | null>(null);

/**
 * Context를 구독하는 컴포넌트(MemberHighlightCareer, MemberTimelineSection)가
 * Provider 바깥에서 쓰이면 바로 알 수 있도록 명확한 에러를 던진다 — silent하게
 * undefined를 다루다 늦게 디버깅하는 것보다 안전하다.
 */
export function useMemberCareer(): MemberCareerContextValue {
  const ctx = useContext(MemberCareerContext);
  if (!ctx) {
    throw new Error("useMemberCareer는 <MemberCareerProvider> 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}

interface MemberCareerProviderProps {
  memberId: string;
  isAdmin: boolean;
  children: ReactNode;
}

/**
 * 회원의 Timeline 데이터(대표 커리어 + 본문)와 추가/수정 모달을 단일
 * source of truth로 관리하는 Provider.
 *
 * 배경: 대표 커리어 카드(회원 상세 상단, 프로필 요약 정보)와 Timeline 본문
 * 목록(최근 경기 다음, 별개의 화면 위치)이 같은 데이터(member_timeline)를
 * 보여주지만 화면에서는 서로 멀리 떨어져 있어야 한다. 두 영역을 하나의
 * 컴포넌트로 합쳐 같은 자리에서 렌더링하면 위치 요구사항이 깨지고, 완전히
 * 분리해서 각자 fetch하면(이전 구조) 한쪽에서 대표를 바꿔도 다른 쪽이
 * 다음 GET이 올 때까지 어긋난다.
 *
 * Context는 "위치"와 "데이터"를 분리해준다 — Provider가 페이지 전체를
 * 감싸기만 하면, 그 안의 어디서든 useMemberCareer()로 같은 items를 읽을 수
 * 있다. 두 컴포넌트가 화면에서 멀리 떨어져 있어도 데이터는 항상 같다.
 *
 * 향후 "최고 LP", "최고 승률", "최근 우승", "대표 전적" 같은 회원 프로필
 * 요약 정보가 추가되면, 같은 패턴(이 Provider에 필드를 늘리거나 비슷한
 * Provider를 추가)으로 확장한다.
 *
 * page.tsx(서버 컴포넌트) 자체를 클라이언트로 바꾸지 않는 이유: 그 페이지는
 * service-role Supabase 조회, isAdminSession()(쿠키 기반 서버 세션),
 * notFound() 등 서버 전용 API에 깊이 의존한다. 이를 클라이언트로 옮기면
 * 모든 데이터를 API route로 새로 노출해야 하고 서버 렌더링의 이점(첫 로드
 * 성능)을 잃는다 — 이 작은 클라이언트 Provider 하나만 끼워 넣는 것이
 * 훨씬 적은 비용으로 같은 효과를 낸다.
 */
export function MemberCareerProvider({ memberId, isAdmin, children }: MemberCareerProviderProps) {
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

  /**
   * PUT/POST가 성공하면 서버가 돌려준 최신 row를 받아 즉시 반영한다.
   * loadTimeline()의 GET 응답이 늦게 오거나 일시적으로 실패해도, 화면은
   * 이 시점부터 이미 정확한 값을 보여준다 — refetch는 그 뒤에 "진실 동기화"
   * 목적으로 한 번 더 호출하되, 화면 반영 자체는 이 함수가 보장한다.
   *
   * items가 Provider 하나에 있는 단일 state라서, 이 한 번의 호출만으로
   * 대표 커리어 카드(highlighted)와 본문 목록(bodyItems)이 — 둘 다 items에서
   * 파생되므로 — 같은 렌더링 사이클에서 함께 갱신된다.
   */
  function applySavedItem(saved: MemberTimeline) {
    setItems((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      let next = exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
      // 서버가 단일 대표 커리어를 보장하므로(같은 회원의 기존 대표를 먼저
      // false로 내린 뒤 이 항목을 true로 저장), 화면도 그 사실을 즉시
      // 반영해야 한다 — 그러지 않으면 loadTimeline()의 GET 응답이 오기
      // 전까지 잠깐 "대표"가 두 개로 보이는 상태가 생긴다.
      if (saved.is_highlight) {
        next = next.map((item) => (item.id === saved.id ? item : { ...item, is_highlight: false }));
      }
      return [...next].sort((a, b) => {
        const aYear = a.event_year;
        const bYear = b.event_year;
        if (aYear !== bYear) {
          // 연도를 모르는 항목(null)은 맨 뒤로 — GET의 nullsFirst:false와 동일한 순서.
          if (aYear === null) return 1;
          if (bYear === null) return -1;
          return bYear - aYear;
        }
        const aMonth = a.event_month ?? 0;
        const bMonth = b.event_month ?? 0;
        if (aMonth !== bMonth) return bMonth - aMonth;
        return b.created_at.localeCompare(a.created_at);
      });
    });
  }

  /** 삭제 성공 시 해당 id를 목록에서 즉시 제거한다(optimistic). */
  function removeDeletedItem(deletedId: string) {
    setItems((prev) => prev.filter((item) => item.id !== deletedId));
  }

  const highlighted = items.find((item) => item.is_highlight) ?? null;
  // 정책: isHighlight=true 항목은 대표 커리어 영역에만 노출하고 본문 목록에서는
  // 제외한다. 대표가 해제되면(is_highlight=false) 다음 렌더에서 이 필터를
  // 자동으로 빠져나와 본문에 다시 나타난다 — 별도 처리 없이 필터 조건 하나로
  // "해제 시 자동 복귀" 요구사항이 만족된다.
  const bodyItems = items.filter((item) => !item.is_highlight);

  const value: MemberCareerContextValue = {
    items,
    loading,
    isAdmin,
    highlighted,
    bodyItems,
    openAddModal: () => setShowAddModal(true),
    openEditModal: (item) => setEditingItem(item),
  };

  return (
    <MemberCareerContext.Provider value={value}>
      {children}

      {/* 모달은 Provider에 단 하나만 존재한다 — 대표 커리어 카드를 클릭했든
          본문 목록의 카드를 클릭했든 같은 editingItem/onSaved 경로를 타므로,
          저장 시 items 하나만 갱신되면 화면 어디에 있든 함께 즉시 반영된다
          ("히스토리백" 없이 모달만 닫히고 같은 화면에 남는다). */}
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
    </MemberCareerContext.Provider>
  );
}
