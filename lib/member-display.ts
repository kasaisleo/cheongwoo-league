import type { Member } from "@/lib/supabase/database.types";

/**
 * 회원 목록에서 같은 닉네임을 가진 회원이 여럿일 때, 구분할 수 있는 표시 이름을 만든다.
 * - district가 있으면 "닉네임 (district)"
 * - district가 없으면 "닉네임 #id뒤4자리"
 * - 닉네임이 유일하면 그냥 "닉네임" 그대로 반환
 */
export function getDisambiguatedName(member: Member, allMembers: Member[]): string {
  const sameNicknameCount = allMembers.filter((m) => m.nickname === member.nickname).length;
  if (sameNicknameCount <= 1) {
    return member.nickname;
  }

  if (member.district) {
    return `${member.nickname} (${member.district})`;
  }

  return `${member.nickname} #${member.id.slice(-4)}`;
}
