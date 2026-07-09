-- ============================================================
-- 0028: demo_entities — 체험 데모 모드 임시 데이터 테이블
-- ============================================================
--
-- 모든 데모 데이터를 단일 JSONB 테이블에 저장한다 (A안).
-- demo_session_id (UUID 문자열) 로 세션 격리.
-- expires_at TTL 기반 자동 만료 + lazy cleanup + Vercel cron.
-- 실서비스 테이블에는 절대 write 하지 않는다.

CREATE TABLE IF NOT EXISTS public.demo_entities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id text     NOT NULL,
  entity_type  text        NOT NULL CHECK (entity_type IN ('club', 'member', 'match', 'activity')),
  payload      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_demo_entities_session
  ON public.demo_entities (demo_session_id);

CREATE INDEX IF NOT EXISTS idx_demo_entities_type
  ON public.demo_entities (entity_type);

CREATE INDEX IF NOT EXISTS idx_demo_entities_expires
  ON public.demo_entities (expires_at);

-- 모든 접근은 service_role 경유 — 공개 policy 없음
ALTER TABLE public.demo_entities ENABLE ROW LEVEL SECURITY;
