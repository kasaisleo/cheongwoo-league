-- ClubSkin-2: clubs 테이블에 스킨/외관 컬럼 추가
--
-- skin_key: 코드 registry(lib/club-skin.ts)에서 디자인 정의를 결정하는 키.
--           slug는 URL 식별자이며 스킨 결정에 사용하지 않는다.
-- appearance_config: 스킨 오버라이드를 위한 확장 필드 (현재 미사용, 향후 확장용).
--
-- CHECK constraint 미적용: 새 스킨 추가 시 migration 없이 코드 registry에서 관리.
-- 허용 skin_key: default | cheongwoo | namaste (lib/club-skin.ts SkinKey 참조)

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS skin_key text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS appearance_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 기존 클럽 초기화
-- slug = 'cheongwoo' 인 클럽만 cheongwoo 스킨으로 설정
UPDATE public.clubs SET skin_key = 'cheongwoo' WHERE slug = 'cheongwoo';

-- namaste 클럽이 존재하면 namaste 스킨 설정 (없으면 no-op)
UPDATE public.clubs SET skin_key = 'namaste' WHERE slug = 'namaste';

-- 그 외 모든 클럽은 DEFAULT 'default' 유지
