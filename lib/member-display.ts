import type { Member } from "@/lib/supabase/database.types";

/**
 * 표시명 정책 (Step 12 통일):
 *   메인 표시명 = members.name
 *   보조 표시명 = members.nickname (name과 같거나 없으면 null 반환)
 *
 * 전 화면(팀 배정, 회원목록, 출석, 경기, LP이력)에서 이 두 함수를 통해 통일한다.
 */

/** 메인 표시명 — 항상 members.name을 반환한다. */
export function getMemberName(member: Pick<Member, "name">): string {
  return member.name;
}

/**
 * 보조 표시명 — nickname이 name과 다를 때만 반환, 같거나 비어있으면 null.
 * 렌더링: `{sub && <span className="text-xs text-line-400">{sub}</span>}`
 */
export function getMemberSubName(
  member: Pick<Member, "name" | "nickname">
): string | null {
  if (!member.nickname || member.nickname === member.name) return null;
  return member.nickname;
}

/**
 * 한 줄 표시용 — "이름 · 닉네임" 또는 "이름"(닉네임이 같거나 없으면).
 * 컴팩트한 텍스트 영역(팀 표시, 토글 버튼 등)에서 사용한다.
 *
 * 예: "김경희 · NY" / "홍길동"
 */
export function getMemberDisplayLabel(
  member: Pick<Member, "name" | "nickname">
): string {
  const sub = getMemberSubName(member);
  return sub ? `${member.name} · ${sub}` : member.name;
}

/**
 * 기존 호환용. getDisambiguatedName을 호출하던 곳(attendance 페이지 2곳)이
 * 그대로 동작하도록 유지한다. 내부는 name 기반으로 교체.
 *
 * 기존: nickname 기반, 동명이인 구분에 district/#id 사용
 * 변경: name 기반. name이 겹치면 district로 구분, 없으면 nickname으로 구분.
 *
 * @deprecated 신규 코드에서는 getMemberDisplayLabel을 사용할 것.
 */
export function getDisambiguatedName(
  member: Pick<Member, "id" | "name" | "nickname" | "district">,
  allMembers: Pick<Member, "id" | "name">[]
): string {
  const sameNameCount = allMembers.filter((m) => m.name === member.name).length;
  if (sameNameCount <= 1) {
    return member.name;
  }

  if (member.district) {
    return `${member.name} (${member.district})`;
  }

  // district도 없으면 nickname으로 구분 (nickname이 name과 같으면 #id로 fallback)
  const sub = getMemberSubName(member);
  if (sub) {
    return `${member.name} (${sub})`;
  }

  return `${member.name} #${member.id.slice(-4)}`;
}
