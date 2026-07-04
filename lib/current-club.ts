/**
 * currentClubId 최소 구조 (Phase 2A, 1차 작업)
 *
 * 목적: 지금까지 46개 파일에 흩어져 있던 `CHEONGWOO_CLUB_ID` 하드코딩 값의
 * 단일 출처를 이 파일 하나로 모은다. 이번 단계에서는 동작을 전혀 바꾸지 않고,
 * 앞으로 값의 출처를 바꿀 수 있는 접점(seam)만 만든다.
 *
 * - DEFAULT_CLUB_ID: 클라이언트 컴포넌트("use client")에서 참조할 상수.
 * - getCurrentClubId(): 서버 컴포넌트/API route에서 호출할 함수.
 *   지금은 DEFAULT_CLUB_ID를 그대로 반환하지만, 처음부터 async로 선언해
 *   나중에 쿠키 등 비동기 로직이 추가되어도 호출부(호출하는 쪽 코드)를
 *   다시 고치지 않아도 되게 한다.
 *
 * ⚠️ 이번 파일은 아직 어디에서도 import되지 않는다 — 기존 46개 파일,
 * auth_user_id 조회 로직, 권한 함수 4개는 이번 작업에서 건드리지 않았다.
 */

export const DEFAULT_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

export async function getCurrentClubId(): Promise<string> {
  return DEFAULT_CLUB_ID;
}
