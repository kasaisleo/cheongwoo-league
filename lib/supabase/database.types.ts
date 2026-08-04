// Supabase 스키마 기반 타입 정의
// 실제 운영 환경에서는 `supabase gen types typescript --linked`로 생성한 파일로 교체 권장.

export type MemberGrade = "A" | "B" | "C" | "D";
export type MemberRole =
  | "회장"
  | "부회장"
  | "총무"
  | "경기이사"
  | "홍보이사"
  | "운영이사"
  | "섭외이사"
  | "고문";
export type MemberType = "정회원" | "준회원" | "게스트";
export type PermissionRole = "member" | "scorer" | "manager" | "admin" | "master";
export type AttendanceStatus = "attending" | "absent" | "undecided";
export type SessionDay = "saturday" | "sunday" | "holiday" | "custom";
export type SessionStatus = "open" | "closed" | "archived";
export type WinnerTeam = "A" | "B";
export type StagingValidationStatus =
  | "pending"
  | "valid"
  | "duplicate"
  | "missing_required"
  | "invalid_phone"
  | "invalid_mapo_score"
  | "needs_review"
  | "imported"
  | "skipped";
/** Match System 2.0 (0050). court_assignment_enabled과의 조합 제약은 DB에서 강제하지 않는다 — normalize_match_config 참고. */
export type MatchSlotMode = "none" | "ordered" | "timed";
/** Match System 2.0 (0050). 전이 규칙: draft→{active,completed,cancelled}, active→{completed,cancelled}, completed→{active}(재오픈), cancelled는 terminal. */
export type EventStatus = "draft" | "active" | "completed" | "cancelled";
/** Match System 2.0 (0050). legacy_attendance_session은 향후 backfill phase 예약값 — 이번 phase에서는 native만 실제 생성됨. */
export type EventSource = "native" | "legacy_attendance_session";

export interface Member {
  id: string;
  name: string;
  nickname: string;
  /** @deprecated 0004부터 미사용. 실력 등급 — LP 시스템으로 대체됨. 신규 코드에서 참조하지 말 것. */
  grade: MemberGrade;
  /** 클럽 내 운영 직책. 직책이 없으면 null(회원 구분은 member_type을 본다). */
  role: MemberRole | null;
  phone: string | null;
  mapo_score: number | null;
  /** @deprecated 0004부터 미사용. ELO 레이팅 — league_point로 대체됨. 신규 코드에서 참조하지 말 것. */
  rating: number;
  wins: number;
  losses: number;
  is_active: boolean;
  /** 휴면회원 여부. is_active(삭제/숨김)와 별개의 축 — 자격/이력은 유지하되 신규 활동 대상에서만 제외한다. */
  is_dormant: boolean;
  member_type: MemberType;
  league_point: number;
  permission_role: PermissionRole;
  kakao_provider_id: string | null;
  is_kakao_linked: boolean;
  address_full: string | null;
  district: string | null;
  age: number | null;
  memo: string | null;
  player_background: string;
  created_at: string;
  /** Step 10-1: Supabase Auth(auth.users)와 연결된 식별자. null이면 카카오 로그인으로 아직 연결되지 않은 회원. */
  auth_user_id: string | null;
  /** soft delete 처리 시각. null = 활성 회원, 값이 있으면 탈퇴 처리된 회원. */
  deleted_at: string | null;
}

export interface MemberWithStats extends Member {
  win_rate: number;
  /** 전체 경기 누적 득점차 (내팀 - 상대팀). 경기 없으면 0. 동점 시 4번째 정렬 기준. */
  score_diff: number;
}

/** 클럽별 카카오 연결 대기 요청. 사용자가 해당 클럽 context에서 로그인했으나 미연결 상태일 때 생성된다. */
export interface PendingLinkRequest {
  id: string;
  auth_user_id: string;
  club_id: string;
  /** 카카오 표시명만 저장. 이메일·identities 저장 금지. */
  display_name: string | null;
  created_at: string;
  /** 재로그인(upsert) 시 갱신. 관리자가 staleness 판단에 사용. */
  updated_at: string;
}

export interface Match {
  id: string;
  played_at: string;
  session_id: string | null;
  team_a_player1_member: string | null;
  team_a_player1_guest: string | null;
  team_a_player2_member: string | null;
  team_a_player2_guest: string | null;
  team_b_player1_member: string | null;
  team_b_player1_guest: string | null;
  team_b_player2_member: string | null;
  team_b_player2_guest: string | null;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: WinnerTeam;
  created_by: string | null;
  created_at: string;
  club_id: string;
}

/** 경기 화면에 표시할 선수 정보. 회원이든 게스트든 동일한 모양으로 다룬다. */
export interface MatchPlayerDisplay {
  id: string;
  /** 표시명. 회원이면 members.name, 게스트면 guests.name. */
  name: string;
  isGuest: boolean;
}

export interface RatingHistory {
  id: string;
  match_id: string;
  member_id: string;
  rating_before: number;
  rating_after: number;
  rating_change: number;
  created_at: string;
}

/**
 * point_history 원본 행 그대로(단일 flat 타입 — 이 파일의 다른 테이블과 동일한
 * 컨벤션). 이 테이블에 대한 client-side INSERT/UPDATE 호출이 저장소 어디에도
 * 없으므로(유일한 쓰기 경로는 supabase/migrations/0045의 RPC — supabase.rpc()
 * 호출이지 .from("point_history").insert()가 아니다) Row/Insert/Update로
 * 분리할 실익이 없다. 신규 코드에서 이 인터페이스로 insert/update payload를
 * 직접 구성하지 말 것.
 */
export interface PointHistory {
  id: string;
  match_id: string | null;
  member_id: string;
  club_id: string;
  point_before: number;
  point_after: number;
  point_change: number;
  reason: string;
  created_at: string;
  /** club_id+member_id 범위에서만 삽입 순서를 보장(0048). 전역 커밋 순서 아님 —
   * DB가 identity로 자동 채우므로 이 필드를 직접 지정하는 INSERT를 작성하지 말 것. */
  sequence_no: number;
  /** sequence_no가 실제 삽입 순서를 신뢰할 수 있는지 여부(0048). migration
   * 적용 이전 기존 행은 false, 이후 신규 행은 DB default로 자동 true. */
  sequence_trusted: boolean;
}

export interface MemberTimeline {
  id: string;
  member_id: string;
  timeline_type: string;
  /** [호환용] event_year/event_month로부터 합성된 날짜. 화면 표시에는 쓰지 않는다 — event_year/event_month를 본다. */
  event_date: string | null;
  /** Timeline 사건의 연도. 정책상 필수(신규 등록은 API에서 강제). */
  event_year: number | null;
  /** Timeline 사건의 월(1~12). 선택값, 모르면 null. */
  event_month: number | null;
  title: string;
  description: string | null;
  /** 대회명 원본 (competition 타입). title 자동조립의 source — title을 파싱해 복원하지 않고 이 컬럼으로 edit 폼을 채운다. */
  competition_name: string | null;
  /** 리그명 원본 (league 타입). title 자동조립의 source. */
  league_name: string | null;
  /** 직책 원본 (system 타입, 현재 비활성). title 자동조립의 source. */
  role: string | null;
  association: string | null;
  division: string | null;
  result: string | null;
  memo: string | null;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
}

export interface StagingMember {
  id: string;
  raw_name: string | null;
  raw_nickname: string | null;
  raw_phone: string | null;
  raw_address: string | null;
  raw_age: string | null;
  raw_mapo_score: string | null;
  raw_member_type: string | null;
  raw_birth_year: string | null;
  normalized_name: string | null;
  normalized_nickname: string | null;
  normalized_phone: string | null;
  normalized_address: string | null;
  normalized_district: string | null;
  normalized_age: number | null;
  normalized_mapo_score: number | null;
  normalized_member_type: string | null;
  normalized_birth_year: number | null;
  corrected_age: number | null;
  validation_status: StagingValidationStatus;
  validation_errors: string | null;
  existing_member_id: string | null;
  memo: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  member_id: string;
  event_date: string;
  status: AttendanceStatus;
  session_id: string | null;
  updated_at: string;
}

export interface AttendanceSession {
  id: string;
  session_date: string;
  session_day: SessionDay;
  title: string;
  status: SessionStatus;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  club_id: string;
}

export interface Guest {
  id: string;
  name: string;
  club_id: string;
  age: number | null;
  years_playing: number | null;
  phone: string | null;
  referred_by: string | null;
  visit_date: string;
  skill_grade: MemberGrade | null;
  manner_score: number | null;
  reinvite: boolean | null;
  notes: string | null;
  wins: number;
  losses: number;
  converted_to_member_id: string | null;
  /** 비활성화 여부. false = 새 경기 입력 후보에서 제외. */
  is_active: boolean;
  created_at: string;
}

export interface PlatformAdmin {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  /** 'owner' | 'admin' | 'analyst' */
  role: string;
  /** 'active' | 'inactive' */
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformAdminSession {
  id: string;
  admin_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface SessionGuest {
  id: string;
  session_id: string;
  guest_id: string;
  added_by: string | null;
  created_at: string;
  /** join용 — 조회 시 guests 테이블 join */
  guest?: Pick<Guest, "id" | "name" | "phone" | "is_active">;
}

/**
 * clubs.match_config_defaults / events.match_config의 jsonb 형태(config v1, 0050).
 * 실제 값 보장은 DB의 normalize_match_config(정상화 함수)와 CHECK 제약이 하며, 이 타입은
 * 그 정규화된 결과의 모양만 기술한다 — 신규 코드에서 이 타입으로 직접 payload를 조립해
 * RPC 없이 clubs/events에 쓰지 말 것(둘 다 쓰기는 create_event/update_event/
 * set_club_match_config_defaults RPC 경유가 유일한 정상 경로).
 */
export interface MatchConfigV1 {
  version: 1;
  attendance_enabled: boolean;
  participant_confirmation_required: boolean;
  court_assignment_enabled: boolean;
  slot_mode: MatchSlotMode;
  pre_scheduling_enabled: boolean;
  live_queue_enabled: boolean;
  auto_generation_enabled: boolean;
  review_required: boolean;
  court_count: number | null;
  max_games_per_member: number | null;
  rest_gap_minutes: number | null;
  partner_repeat_limit: number | null;
  opponent_repeat_limit: number | null;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "inactive";
  /** Event 생성 시 snapshot으로 복사되는 클럽 기본 운영 설정(0050). 정상 변경 경로는 set_club_match_config_defaults RPC뿐. */
  match_config_defaults: MatchConfigV1;
  created_at: string;
}

/**
 * Match System 2.0 최상위 Event(0050). v1은 하루 단위(event_date만 사용).
 * 쓰기는 create_event/update_event RPC 전용 — service_role조차 테이블에 직접
 * INSERT/UPDATE 권한이 없다(DB GRANT로 강제됨). event_courts/event_sessions/
 * event_participants/matches lifecycle 연결은 전부 별도 phase.
 */
export interface Event {
  id: string;
  club_id: string;
  title: string;
  event_date: string;
  status: EventStatus;
  source: EventSource;
  match_config: MatchConfigV1;
  attendance_opened_at: string | null;
  attendance_closed_at: string | null;
  participants_confirmed_at: string | null;
  scheduling_confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: Partial<Member> & { name: string; nickname: string; grade: MemberGrade };
        Update: Partial<Member>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Partial<Match> & {
          score_a: number;
          score_b: number;
          winner_team: WinnerTeam;
        };
        Update: Partial<Match>;
        Relationships: [];
      };
      rating_history: {
        Row: RatingHistory;
        Insert: Partial<RatingHistory> & {
          match_id: string;
          member_id: string;
          rating_before: number;
          rating_after: number;
          rating_change: number;
        };
        Update: Partial<RatingHistory>;
        Relationships: [];
      };
      point_history: {
        Row: PointHistory;
        Insert: Partial<PointHistory> & {
          member_id: string;
          point_before: number;
          point_after: number;
          point_change: number;
          reason: string;
        };
        Update: Partial<PointHistory>;
        Relationships: [];
      };
      member_timeline: {
        Row: MemberTimeline;
        Insert: Partial<MemberTimeline> & { member_id: string; title: string };
        Update: Partial<MemberTimeline>;
        Relationships: [];
      };
      staging_members: {
        Row: StagingMember;
        Insert: Partial<StagingMember>;
        Update: Partial<StagingMember>;
        Relationships: [];
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance> & { member_id: string; event_date: string; status: AttendanceStatus };
        Update: Partial<Attendance>;
        Relationships: [];
      };
      attendance_sessions: {
        Row: AttendanceSession;
        Insert: Partial<AttendanceSession> & {
          session_date: string;
          session_day: SessionDay;
          title: string;
        };
        Update: Partial<AttendanceSession>;
        Relationships: [];
      };
      guests: {
        Row: Guest;
        Insert: Partial<Guest> & { name: string; visit_date: string };
        Update: Partial<Guest>;
        Relationships: [];
      };
      platform_admins: {
        Row: PlatformAdmin;
        Insert: Partial<PlatformAdmin> & { username: string; password_hash: string };
        Update: Partial<PlatformAdmin>;
        Relationships: [];
      };
      platform_admin_sessions: {
        Row: PlatformAdminSession;
        Insert: Partial<PlatformAdminSession> & {
          admin_id: string;
          token_hash: string;
          expires_at: string;
        };
        Update: Partial<PlatformAdminSession>;
        Relationships: [];
      };
    };
    Views: {
      member_stats: {
        Row: MemberWithStats;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
