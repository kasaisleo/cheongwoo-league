/**
 * lib/admin-member-status.ts — 회원 활동 상태(활동/휴면/탈퇴) 판정 공통 helper.
 *
 * 정책(정확한 정의):
 *   - 활동: is_active = true, deleted_at = null
 *   - 휴면: is_active = false, deleted_at = null
 *   - 탈퇴: deleted_at IS NOT NULL (is_active 값과 무관하게 탈퇴가 우선)
 *
 * members.is_dormant(별개 컬럼, "휴면회원" 자격유지 개념)와는 무관한 축이다 —
 * 이 helper는 그 필드를 다루지 않는다.
 */
export type AdminMemberStatus = "active" | "dormant" | "withdrawn";

export function deriveMemberStatus(is_active: boolean, deleted_at: string | null): AdminMemberStatus {
  if (deleted_at) return "withdrawn";
  if (!is_active) return "dormant";
  return "active";
}
