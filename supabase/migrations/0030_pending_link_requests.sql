-- ============================================================
-- 0030: pending_link_requests — 클럽별 카카오 연결 대기 요청
-- ============================================================
--
-- 보안 목적:
--   - 기존 pending-users API는 auth.admin.listUsers()로 플랫폼 전체 Kakao 계정을
--     반환한 뒤 현재 클럽 기준으로만 필터링했음.
--   - 이로 인해 다른 클럽에 연결된 계정의 이메일·닉네임이 타 클럽 관리자에게 노출.
--
-- 해결:
--   - 사용자가 Kakao 로그인 후 해당 클럽에 미연결 상태일 때만 클럽별 pending row 생성.
--   - 관리자는 자기 club_id의 pending row만 조회 → 타 클럽 계정 정보 차단.
--   - display_name만 저장 (이메일 저장 금지).
--
-- 접근 제어:
--   - RLS enabled, 공개 policy 없음 → service_role API만 접근 가능.
--
-- 정책:
--   - (auth_user_id, club_id) UNIQUE → 동일 사용자·클럽 중복 방지 (ON CONFLICT DO NOTHING).
--   - club_id FK → clubs(id) ON DELETE CASCADE (클럽 삭제 시 자동 정리).
--   - auth_user_id에 auth.users FK 없음 (cascade 복잡성 회피; 연결 성공 시 앱 레벨 삭제).
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_link_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid        NOT NULL,
  club_id      uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  display_name text,                        -- 카카오 표시명만 저장 (이메일 금지)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(), -- upsert 시 갱신; staleness 판단용
  UNIQUE (auth_user_id, club_id)
);

ALTER TABLE pending_link_requests ENABLE ROW LEVEL SECURITY;
-- 공개 SELECT/INSERT/UPDATE/DELETE policy 없음 — service_role 전용

CREATE INDEX IF NOT EXISTS idx_pending_link_requests_club
  ON pending_link_requests (club_id, created_at DESC);
