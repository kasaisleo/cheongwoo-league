-- ============================================================
-- 0027: members.auth_user_id 멀티클럽 정책 적용
-- ============================================================
--
-- 목적:
--   같은 Supabase Auth user가 여러 클럽의 members row에 연결될 수 있어야 한다.
--   금지: 같은 (club_id, auth_user_id) 쌍이 한 클럽 안에서 중복되는 것.
--   허용: 같은 auth_user_id가 다른 club_id의 members row에 각각 존재하는 것.
--
-- 실행 전 필수 확인 쿼리:
-- ============================================================

-- [Step 0] 현재 제약조건/인덱스 확인 (결과를 메모해둘 것)
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.members'::regclass
-- ORDER BY contype, conname;
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'members'
-- AND (indexdef ILIKE '%auth_user_id%' OR indexdef ILIKE '%club_id%');

-- [Step 1] 충돌 데이터 확인 — 아래 쿼리가 0 rows를 반환해야 migration 안전.
-- 같은 club 안에 같은 auth_user_id가 2개 이상 연결된 경우 = 실제 충돌.
-- SELECT club_id, auth_user_id, COUNT(*) AS cnt
-- FROM public.members
-- WHERE auth_user_id IS NOT NULL
-- GROUP BY club_id, auth_user_id
-- HAVING COUNT(*) > 1;

-- [Step 2] 전역 unique 존재 시 제거 (아래 이름이 실제 제약명과 다를 수 있음 — Step 0 결과 확인 후 교체)
-- ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_auth_user_id_key;
-- DROP INDEX IF EXISTS members_auth_user_id_key;
-- DROP INDEX IF EXISTS idx_members_auth_user_id;   -- 인덱스명 확인 후 교체

-- [Step 3] (club_id, auth_user_id) 복합 unique partial 인덱스 생성
-- auth_user_id IS NOT NULL 조건 → null은 여러 개 허용 (연결 전 상태)
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_club_auth_user_unique
  ON public.members (club_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON INDEX idx_members_club_auth_user_unique IS
  '같은 클럽 안에서 auth_user_id 중복 연결 방지. null(미연결)은 여러 개 허용. 다른 클럽의 같은 auth_user_id는 정상(멀티클럽 정책).';

-- [Step 4] (선택) (club_id, phone) 복합 unique partial 인덱스
-- phone은 같은 클럽 안에서만 중복 금지. 다른 클럽의 같은 번호는 허용.
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_club_phone_unique
  ON public.members (club_id, phone)
  WHERE phone IS NOT NULL;

COMMENT ON INDEX idx_members_club_phone_unique IS
  '같은 클럽 안에서 phone 중복 방지. null은 허용. 다른 클럽의 같은 번호는 정상(멀티클럽 정책).';
