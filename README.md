# Cheongwoo League

테니스 클럽 매치 레이팅 웹앱. Next.js (App Router) + Tailwind CSS + Supabase.

## 시작하기

1. 의존성 설치
   ```bash
   npm install
   ```

2. Supabase 프로젝트 생성 후 `.env.example`을 `.env.local`로 복사하고 값 채우기
   ```bash
   cp .env.example .env.local
   ```

3. DB 스키마 적용 (Supabase SQL Editor에 `supabase/migrations/0001_init.sql` 내용 실행)

4. 개발 서버 실행
   ```bash
   npm run dev
   ```

## 운영진 인증

회원 전체 로그인은 없습니다. 경기 결과 입력(`/matches/new`), 회원 등록(`/members/new`),
게스트 등록(`/guests/new`)은 운영진 비밀번호로 보호되며, `/admin`에서 로그인합니다.
비밀번호는 `.env.local`의 `ADMIN_PASSWORD`로 설정합니다.

## ELO 레이팅 계산 방식

- 복식 경기: 팀 레이팅 = 두 선수 레이팅의 평균
- 표준 ELO 공식으로 팀 단위 승/패에 따른 변동치를 계산 (K-factor = 32)
- 같은 팀 두 선수는 동일한 변동치(±)를 적용받음
- 계산 로직: `lib/elo.ts`

## 등급별 초기 레이팅

| 등급 | 초기 레이팅 |
|------|------------|
| A    | 1700       |
| B    | 1500       |
| C    | 1300       |
| D    | 1100       |

## 폴더 구조

```
app/            라우트 (페이지 + API)
components/     UI 컴포넌트 (기능별 분리)
lib/            ELO 계산, Supabase 클라이언트, 인증 로직
supabase/       DB 마이그레이션
```
