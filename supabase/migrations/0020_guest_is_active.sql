-- migration 0020: guests.is_active 컬럼 추가
-- 게스트 비활성화(soft delete) 처리.
-- is_active = false → 새 경기 입력 후보에서 제외, 기존 기록 유지.
-- null이 없도록 DEFAULT true 지정.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN guests.is_active IS
  'false = 비활성화된 게스트. 새 경기 입력 후보에서 제외되지만 기존 경기/방문 기록은 유지됨.';
