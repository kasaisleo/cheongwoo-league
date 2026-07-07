-- staging_members에 club_id 컬럼을 추가한다.
--
-- 배경: staging_members는 회원 CSV/XLSX 일괄 import의 임시 작업 공간인데,
-- club_id가 없어 두 클럽의 owner가 동시에 import 기능을 쓰면 서로의 staging
-- 데이터가 섞이거나(삭제/노출) 잘못된 클럽으로 회원이 등록될 위험이 있었다.
--
-- 참고: 실제 운영 DB(Supabase)에는 이 migration과 별개로 이미 직접 적용되어
-- 있다(기존 34개 row는 전부 imported 상태였고, truncate 후 적용했다). 이
-- migration 파일은 git 이력 보존 및 다른 환경(로컬/스테이징 등) 적용을 위한
-- 것이라 truncate는 포함하지 않고, 기존 데이터가 남아있는 환경에서도 안전하게
-- 적용되도록 청우회 club_id로 백필한다.
--
-- 중복 실행에 안전하도록(idempotent) if not exists / where 조건을 사용한다.

begin;

alter table public.staging_members
  add column if not exists club_id uuid references public.clubs(id);

update public.staging_members
set club_id = '465ae133-893e-425d-a093-161f7654bd0d'
where club_id is null;

alter table public.staging_members
  alter column club_id set not null;

create index if not exists idx_staging_members_club_id
  on public.staging_members(club_id);

comment on column public.staging_members.club_id
  is '이 staging 행이 속한 클럽. import upload/preview/commit 전 과정에서 이 값으로 필터링한다.';

commit;
