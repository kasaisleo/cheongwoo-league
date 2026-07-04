/**
 * club 관련 공용 상수 (Phase 3A-1, 재설계)
 *
 * 이 파일은 어떤 서버 전용 모듈도 import하지 않는 순수 상수 파일이다.
 * next/headers, lib/supabase/server 등 서버 전용 코드는 이 파일에 절대
 * 추가하지 않는다 — 클라이언트 컴포넌트("use client")가 이 파일을 안전하게
 * import할 수 있어야 하기 때문이다 (그래서 lib/current-club.ts와 분리했다).
 *
 * - DEFAULT_CLUB_ID: 클럽이 1개(청우회)뿐인 현재 상태의 기본값.
 * - SELECTED_CLUB_COOKIE: 클럽 선택 쿠키 이름. 이 파일에서는 값만 정의하고,
 *   실제로 쿠키를 읽거나 쓰는 로직은 여기 두지 않는다 (lib/current-club.ts 담당).
 */

export const DEFAULT_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

export const SELECTED_CLUB_COOKIE = "selected_club_id";
