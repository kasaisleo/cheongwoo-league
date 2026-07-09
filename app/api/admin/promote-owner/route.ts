import { NextResponse } from "next/server";

/**
 * POST /api/admin/promote-owner — 비활성화됨.
 *
 * master 권한 부여/이양/회수는 CENTER COURT에서만 처리한다.
 * /admin 패널에서 master 직접 변경은 금지된다 (MultiClub-AuthPolicy-2).
 *
 * update-member-role API는 master 지정/해제를 이미 차단하고 있다.
 */
export async function POST() {
  return NextResponse.json(
    { error: "master 권한 변경은 CENTER COURT에서만 가능합니다." },
    { status: 403 }
  );
}
