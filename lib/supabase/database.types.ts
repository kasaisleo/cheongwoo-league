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
/** A/B는 승패, D는 무승부(2A-8D — Event 복식 Game의 정확한 5:5). nullable이 아니다. */
export type WinnerTeam = "A" | "B" | "D";
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

/** 0074: 자동 대진용 선수 Profile 값. DB는 enum이 아니라 text + CHECK다. */
export type Gender = 'male' | 'female' | 'unspecified';
export type DominantHand = 'right' | 'left' | 'unspecified';

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
  /** 0074: 자동 대진용 성별. 미입력은 'unspecified'(NOT NULL). */
  gender: Gender;
  /** 0074: 테니스를 시작한 연도. "연차"가 아니라 연도를 저장한다. 모르면 null. */
  tennis_start_year: number | null;
  /** 0074: 주손. 미입력은 'unspecified'(NOT NULL). 양손잡이 옵션은 두지 않는다. */
  dominant_hand: DominantHand;
  created_at: string;
  /** Step 10-1: Supabase Auth(auth.users)와 연결된 식별자. null이면 카카오 로그인으로 아직 연결되지 않은 회원. */
  auth_user_id: string | null;
  /** soft delete 처리 시각. null = 활성 회원, 값이 있으면 탈퇴 처리된 회원. */
  deleted_at: string | null;
}

export interface MemberWithStats extends Member {
  /** 2A-8D-4(0067): wins / total_matches * 100. 분모에 무승부가 포함된다. */
  win_rate: number;
  /** 2A-8D-4(0067): winner_team=D 참여 Match 수. matches에서 파생한다. */
  draws: number;
  /** 2A-8D-4(0067): wins + losses + draws. */
  total_matches: number;
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
  /**
   * 이 Match가 확정한 Event 게임(0057). Event 유래 Match만 채워지고 legacy
   * 경기(출석 세션 기반)는 null이다. Event game당 Match는 최대 1건이며,
   * 값이 있는 Match는 save/clear_event_game_result로만 변경할 수 있다
   * (legacy update/delete_match_with_effects는 0059가 차단한다).
   */
  event_game_id: string | null;
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
  /**
   * 0078: 자동 대진 연속 출전 상한. normalize_match_config는 이 키를 "있을 때만"
   * 검증하고 없으면 주입하지 않는다(다른 키와 다름) — 그래서 optional이다.
   * 키 없음/명시적 null은 모두 알고리즘 v1 기본값 2로 해석된다. 허용 범위 1~10.
   */
  consecutive_games_limit?: number | null;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** 코드 registry(lib/club-skin.ts SkinKey)에서 디자인을 결정하는 키(0030). DB에는 CHECK 제약 없음 — 알 수 없는 값은 getClubSkin()이 "default"로 폴백. */
  skin_key: string;
  /** 스킨 오버라이드용 확장 필드(0030). 현재 미사용, 구조 미확정 — 임의 필드를 가정하지 말 것. */
  appearance_config: Record<string, unknown>;
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

/**
 * Match System 2.0 — Event 안의 코트/운영 슬롯(0051). attendance_sessions와
 * 무관. 쓰기는 create_event_court/update_event_court/reorder_event_courts
 * RPC 전용. 삭제 RPC 없음 — is_active=false로만 비활성화.
 */
export interface EventCourt {
  id: string;
  event_id: string;
  club_id: string;
  name: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Match System 2.0 — Event Court 안의 경기 슬롯(0051). 출석 세션
 * (attendance_sessions)이 아니다. slot_mode는 이 행에 저장하지 않는다 —
 * Event.match_config.slot_mode가 유일한 source of truth. 쓰기는
 * create_event_session/update_event_session/reorder_event_sessions RPC 전용.
 */
export interface EventSession {
  id: string;
  event_id: string;
  club_id: string;
  event_court_id: string;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Match System 2.0 (0052). event_participants.participant_type — member/guest 중 정확히 하나(XOR, DB CHECK로 강제). */
export type ParticipantType = "member" | "guest";
/** Match System 2.0 (0052). event_participants.status. pending/confirmed는 is_active=true, withdrawn/excluded는 is_active=false와 항상 짝(DB CHECK로 강제). */
export type ParticipantStatus = "pending" | "confirmed" | "withdrawn" | "excluded";
/** Match System 2.0 (0052). event_participants.source_type — manual(수동 추가)/attendance_member(출석 임포트)/session_guest(게스트 임포트). */
export type ParticipantSourceType = "manual" | "attendance_member" | "session_guest";

/**
 * Match System 2.0 — Event 참가자(0052). identity는 event_id+member_id 또는
 * event_id+guest_id이고 is_active 무관 완전 유니크 — 이벤트당 회원/게스트 1명당
 * 평생 1행이며, withdrawn 후 재추가는 새 행이 아니라 기존 행 복구다. excluded는
 * 운영자 명시 제외 상태라 import가 자동으로 되살리지 않는다(update_event_participant
 * 로만 해제 가능). attendance_sessions/attendance/session_guests와는 어떤 FK로도
 * 연결되지 않는다 — source_attendance_session_id/source_record_id는 breadcrumb일
 * 뿐이다. 쓰기는 import_event_participants_from_attendance/create_event_participant/
 * update_event_participant/confirm_event_participants RPC 전용. 삭제 RPC 없음 —
 * is_active=false(withdrawn/excluded)로만 비활성화.
 */
export interface EventParticipant {
  id: string;
  event_id: string;
  club_id: string;
  participant_type: ParticipantType;
  member_id: string | null;
  guest_id: string | null;
  display_name_snapshot: string;
  source_type: ParticipantSourceType;
  source_attendance_session_id: string | null;
  source_record_id: string | null;
  status: ParticipantStatus;
  is_active: boolean;
  /**
   * 0074: 참가 시점에 굳힌 자동 대진용 Profile.
   * null = 아직 굳지 않음 — 회원은 후속 자동 대진에서 members Profile로
   * fallback/materialize 될 대상이고, 게스트는 정보가 없다는 뜻이다.
   * 'unspecified'(명시적 미지정)와는 의미가 다르므로 구분해서 다룬다.
   */
  gender_snapshot: Gender | null;
  tennis_start_year_snapshot: number | null;
  dominant_hand_snapshot: DominantHand | null;
  created_at: string;
  updated_at: string;
}

/**
 * event_participants RPC 4종의 호출부 시그니처(0052) — 문서화 용도.
 * 이 파일의 Database.Functions는 아직 어떤 RPC와도 연결되어 있지 않으므로
 * (0045/0050/0051의 기존 RPC도 전부 동일) 아래 타입들도 supabase-js 제네릭
 * 추론에는 연결되지 않는다. 실제 호출은 supabase.rpc("이름", params) 형태.
 * private helper(_event_participant_upsert)는 앱 코드에서 직접 호출하지
 * 않는 내부 전용 함수라 여기서 타입을 노출하지 않는다.
 */
export interface ImportEventParticipantsFromAttendanceParams {
  p_event_id: string;
  p_club_id: string;
  p_attendance_session_id: string;
}

/** import_event_participants_from_attendance의 반환 shape(RETURNS TABLE, 항상 1행). */
export interface ImportEventParticipantsResult {
  inserted_count: number;
  reactivated_count: number;
  skipped_duplicate_count: number;
  skipped_excluded_count: number;
  skipped_inactive_member_count: number;
  skipped_inactive_guest_count: number;
}

export interface CreateEventParticipantParams {
  p_event_id: string;
  p_club_id: string;
  p_member_id?: string | null;
  p_guest_id?: string | null;
}
/** create_event_participant의 반환값: 신규 생성되거나 재활성화된 event_participants.id(uuid). */
export type CreateEventParticipantResult = string;

export interface UpdateEventParticipantParams {
  p_participant_id: string;
  p_event_id: string;
  p_club_id: string;
  p_status: ParticipantStatus;
}
/** update_event_participant는 반환값 없음(void). */

export interface ConfirmEventParticipantsParams {
  p_event_id: string;
  p_club_id: string;
}
/** confirm_event_participants의 반환값: pending→confirmed로 전환된 행 수. 0이면 활성 참가자 전원이 이미 confirmed였다는 뜻(strict idempotent no-op 포함). */
export type ConfirmEventParticipantsResult = number;

/**
 * event_courts/event_sessions RPC 6종의 호출부 시그니처(0051, Phase 2A-5B) — 문서화 용도.
 * 위 event_participants RPC 타입들과 동일하게 Database.Functions에는 연결하지 않는다.
 * _event_session_validate_mode는 내부 전용 private helper라 여기서 노출하지 않는다.
 */
export interface CreateEventCourtParams {
  p_event_id: string;
  p_club_id: string;
  p_name: string;
  p_position?: number | null;
}
/** create_event_court의 반환값: 신규 event_courts.id(uuid). */
export type CreateEventCourtResult = string;

export interface UpdateEventCourtParams {
  p_court_id: string;
  p_event_id: string;
  p_club_id: string;
  p_name?: string | null;
  p_position?: number | null;
  p_is_active?: boolean | null;
}
/** update_event_court는 반환값 없음(void). */

export interface ReorderEventCourtsParams {
  p_event_id: string;
  p_club_id: string;
  p_court_ids: string[];
}
/** reorder_event_courts는 반환값 없음(void). p_court_ids는 활성 코트 전체 집합과 정확히 일치해야 한다. */

export interface CreateEventSessionParams {
  p_event_id: string;
  p_club_id: string;
  p_event_court_id: string;
  p_position?: number | null;
  p_starts_at?: string | null;
  p_ends_at?: string | null;
  p_label?: string | null;
}
/** create_event_session의 반환값: 신규 event_sessions.id(uuid). */
export type CreateEventSessionResult = string;

/**
 * update_event_session — 코트 이동 인자 없음(2A-5B 확정: 세션의 코트 간 이동은
 * 현재 RPC 계약에 없으며, 지원하려면 별도 migration이 필요하다. 시각/라벨은
 * 3-상태(미터치/명시적 clear/새 값) 필드라 clear 플래그와 값을 동시에 넣지 않는다.
 */
export interface UpdateEventSessionParams {
  p_session_id: string;
  p_event_id: string;
  p_club_id: string;
  p_position?: number | null;
  p_starts_at?: string | null;
  p_ends_at?: string | null;
  p_clear_times?: boolean;
  p_label?: string | null;
  p_clear_label?: boolean;
  p_is_active?: boolean | null;
}
/** update_event_session은 반환값 없음(void). */

export interface ReorderEventSessionsParams {
  p_event_court_id: string;
  p_event_id: string;
  p_club_id: string;
  p_session_ids: string[];
}
/** reorder_event_sessions는 반환값 없음(void). p_session_ids는 해당 코트의 활성 세션 전체 집합과 정확히 일치해야 한다. */

/**
 * confirm_event_scheduling(0053, Phase 2A-5C) — participants_confirmed_at이 있어야
 * 호출 가능. 이미 scheduling_confirmed_at이 있으면 완전 no-op(재검증 없이 그대로
 * 반환). 코트/슬롯의 실질 변경(0051 RPC 6종)이나 참가자 실질 변경(0052 RPC 3종,
 * confirm_event_participants 제외)이 발생하면 각 RPC 내부에서 자동으로 다시 null이
 * 된다 — 이 RPC를 호출하는 쪽에서 직접 무효화할 일은 없다.
 */
export interface ConfirmEventSchedulingParams {
  p_event_id: string;
  p_club_id: string;
}
/** confirm_event_scheduling은 반환값 없음(void). 최신 scheduling_confirmed_at은 반드시 GET /scheduling 재조회로 확인한다. */

/* ── Event Game (0054, Phase 2A-6B) ───────────────────────────────── */

/** event_games.format — singles는 선수 2명(팀당 1명), doubles는 4명(팀당 2명). DB CHECK로 강제. */
export type EventGameFormat = "singles" | "doubles";
/**
 * event_games.status. 2A-6B-2 현재 RPC로 도달 가능한 값은 draft(생성)와
 * cancelled(취소)뿐이다 — in_progress/completed는 스키마에만 있고 전이 RPC가
 * 아직 없다(경기 진행·결과 입력은 이후 phase).
 */
export type EventGameStatus = "draft" | "in_progress" | "completed" | "cancelled";
/** event_games.source — manual(수동 대진)/auto(자동 편성, 이후 phase). */
export type EventGameSource = "manual" | "auto";
/**
 * 0076: event_games.gender_category — Game 종류.
 * mens(남복) | womens(여복) | mixed(혼복) | open(잡복). null은 미분류.
 */
export type EventGameGenderCategory = "mens" | "womens" | "mixed" | "open";
/**
 * 0076: event_games.gender_category_source — 종류를 누가 정했는지.
 * configured(먼저 지정) | inferred(lineup에서 판정). gender_category와 항상 짝이다.
 */
export type EventGameGenderCategorySource = "configured" | "inferred";
/** event_game_players.team — A/B 두 팀. DB CHECK로 강제. */
export type EventGameTeam = "A" | "B";

/**
 * Match System 2.0 — Event 안의 개별 게임(0054). event_court_id만 있고
 * event_session_id가 없는 행은 none 모드의 "코트만 배정" 상태이고, 둘 다 null이면
 * 미배치다. 점수 컬럼은 없다 — 결과 입력은 이후 phase. 쓰기는 create/update/
 * place/reorder/cancel_event_game + set_event_game_players RPC 전용.
 */
export interface EventGame {
  id: string;
  event_id: string;
  club_id: string;
  event_court_id: string | null;
  event_session_id: string | null;
  format: EventGameFormat;
  status: EventGameStatus;
  source: EventGameSource;
  position: number;
  created_by: string | null;
  /**
   * 0076: Game 종류. gender_category_source와 항상 함께 null이거나 함께 값이 있다
   * (DB paired CHECK). 기존 Game은 backfill되지 않아 둘 다 null(미분류)이다.
   */
  gender_category: EventGameGenderCategory | null;
  gender_category_source: EventGameGenderCategorySource | null;
  /**
   * 0076: source='auto' Game을 관리자가 실제로 수정한 시각. null이면 수정 증거 없음.
   * manual Game은 선수 배정만으로 채워지지 않는다.
   */
  manually_modified_at: string | null;
  /**
   * 0077: 이 Game의 lineup을 만든 자동 대진 실행. source='auto'와 정확히 짝을
   * 이룬다(DB CHECK로 강제) — manual Game은 항상 null, auto Game은 항상 값이 있다.
   */
  pairing_run_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 자동 대진 실행 기록(0077). row 존재 자체가 commit 성공을 뜻한다 — preview는
 * DB write가 없고 commit은 단일 트랜잭션이라 실패한 실행은 남지 않는다.
 * status/committed_at 컬럼은 두지 않는다. 삭제 RPC 없음(provenance 영구 보존).
 * 이 타입은 신규 코드에서 직접 payload를 조립하는 용도가 아니다 — preview/
 * commit RPC(9D-C/9D-D)가 아직 없으므로 현재는 조회 전용 참조 타입이다.
 */
export interface EventPairingRun {
  id: string;
  event_id: string;
  club_id: string;
  algorithm_version: string;
  seed: string;
  config_snapshot: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  input_hash: string;
  result_snapshot: Record<string, unknown>;
  result_hash: string;
  result_summary: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  /** 이 run의 결과가 재생성으로 대체된 시각(9D-D). null이면 아직 유효. */
  superseded_at: string | null;
}

/**
 * Match System 2.0 — event_games의 선수 슬롯(0054). member/guest 전용 컬럼이 없고
 * event_participant_id 하나로 통합 참조한다(레거시 matches의 8-슬롯 방식과 다름).
 */
export interface EventGamePlayer {
  id: string;
  event_game_id: string;
  event_id: string;
  club_id: string;
  event_participant_id: string;
  team: EventGameTeam;
  slot: number;
  created_at: string;
}

/**
 * 게임에 연결된 확정 결과(0057 matches.event_game_id). 점수·승자의 원본은
 * matches 한 곳뿐이므로(event_games에는 점수 컬럼이 없다) 이 값은 연결된
 * Match를 그대로 옮긴 것이다. 결과가 없으면 null.
 */
export interface EventGameResult {
  match_id: string;
  score_a: number;
  score_b: number;
  score_a_tiebreak: number | null;
  score_b_tiebreak: number | null;
  winner_team: WinnerTeam;
  played_at: string;
}

/** GET /api/admin/events/[id]/games 응답의 게임 1건 — 선수와 표시용 이름을 함께 담는다. */
export interface EventGameWithPlayers extends EventGame {
  players: Array<{
    event_participant_id: string;
    team: EventGameTeam;
    slot: number;
    display_name: string;
  }>;
  /** 연결된 Match의 결과. 아직 결과를 저장하지 않았으면 null. */
  result: EventGameResult | null;
}

/**
 * create_event_game(0054) — 게임 생성과 최초 선수 배정을 한 트랜잭션에서 처리한다.
 * 3개 배열(p_participant_ids/p_teams/p_slots)은 같은 길이의 병렬 배열이며,
 * singles는 정확히 2개, doubles는 정확히 4개여야 한다. 참가자는 전부
 * status='confirmed' + is_active여야 한다(participants_confirmed_at은 보지 않는다).
 */
export interface CreateEventGameParams {
  p_event_id: string;
  p_club_id: string;
  p_format: EventGameFormat;
  p_participant_ids: string[];
  p_teams: EventGameTeam[];
  p_slots: number[];
  p_event_court_id?: string | null;
  p_event_session_id?: string | null;
  p_created_by?: string | null;
}
/** create_event_game의 반환값: 신규 event_games.id(uuid). */
export type CreateEventGameResult = string;

/**
 * update_event_game(0054) — 이 phase에서 변경 가능한 "게임 자체 정보"는 format뿐이다.
 * p_format_supplied가 "format을 바꾸려는 의도"를 나타내며, 이것으로 "미지정"과
 * "명시적 null"을 구분한다(false + p_format non-null은 계약 위반으로 거부).
 * format을 실제로 바꿀 때는 새 카디널리티에 맞는 선수 3개 배열이 전부 필요하다.
 */
export interface UpdateEventGameParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
  p_format_supplied?: boolean;
  p_format?: EventGameFormat | null;
  p_participant_ids?: string[] | null;
  p_teams?: EventGameTeam[] | null;
  p_slots?: number[] | null;
}
/** update_event_game은 반환값 없음(void). */

/** set_event_game_players(0054) — draft 게임의 전체 라인업을 한 번에 교체한다(부분 추가/삭제 없음). */
export interface SetEventGamePlayersParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
  p_participant_ids: string[];
  p_teams: EventGameTeam[];
  p_slots: number[];
}
/** set_event_game_players는 반환값 없음(void). */

/**
 * place_event_game(0054) — 코트/세션 배정만 변경한다. 두 인자는 "원하는 최종 상태"
 * 이며 둘 다 null이면 미배치로 되돌린다. none 모드는 session 불가(court만 가능),
 * ordered/timed는 배치 시 court+session 둘 다 필수.
 */
export interface PlaceEventGameParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
  p_event_court_id: string | null;
  p_event_session_id: string | null;
}
/** place_event_game은 반환값 없음(void). */

/**
 * reorder_event_games(0054) — slot_mode='none'일 때만 실행 가능하며, 대상은
 * "status=draft이고 event_session_id가 null인" 실행 큐 전체다(코트만 지정된
 * 게임도 이 큐에 포함된다). p_game_ids는 그 집합과 정확히 일치해야 한다.
 */
export interface ReorderEventGamesParams {
  p_event_id: string;
  p_club_id: string;
  p_game_ids: string[];
}
/** reorder_event_games는 반환값 없음(void). */

/** cancel_event_game(0054) — draft → cancelled만 실제 전이. 이미 cancelled면 no-op. */
export interface CancelEventGameParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
}
/** cancel_event_game은 반환값 없음(void). */

/**
 * save_event_game_result(0059) — 최초 결과 저장과 기존 결과 수정을 한 함수가
 * 처리한다. 승자·Game 상태·Match 생성/연결·포인트 효과는 전부 이 RPC가 단일
 * 트랜잭션에서 결정하므로 호출부가 다시 계산하지 않는다.
 *
 * 선수 4개 인자는 event_game_players의 team/slot(A1·A2·B1·B2)에 그대로 대응한다.
 * 복식만 지원한다(singles는 matches의 XOR CHECK 때문에 저장 자체가 불가).
 * 타이브레이크는 7-6/6-7일 때만 필수이고 그 외에는 null로 정규화된다.
 */
export interface SaveEventGameResultParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
  p_team_a_slot1_participant_id: string;
  p_team_a_slot2_participant_id: string;
  p_team_b_slot1_participant_id: string;
  p_team_b_slot2_participant_id: string;
  p_score_a: number;
  p_score_b: number;
  p_score_a_tiebreak?: number | null;
  p_score_b_tiebreak?: number | null;
  p_actor_member_id?: string | null;
}

/** save_event_game_result의 반환 1행. 같은 요청 재시도는 unchanged로 돌아온다. */
export interface SaveEventGameResultRow {
  event_game_id: string;
  match_id: string;
  result_action: "created" | "updated" | "unchanged";
}

/**
 * clear_event_game_result(0059) — 연결 Match의 포인트·전적 효과를 되돌리고
 * Match를 삭제한 뒤 Game을 draft로 복구한다(선수 배정·코트·순서는 유지).
 * 이미 결과가 없으면 unchanged로 no-op 반환하고, 연결 Match 없이 결과 흔적만
 * 남은 불일치 상태는 EVENT_GAME_RESULT_INCONSISTENT로 거부한다.
 */
export interface ClearEventGameResultParams {
  p_game_id: string;
  p_event_id: string;
  p_club_id: string;
}

/** clear_event_game_result의 반환 1행. */
export interface ClearEventGameResultRow {
  event_game_id: string;
  cleared_match_id: string | null;
  result_action: "cleared" | "unchanged";
}

/**
 * ensure_event_game_count(0061) — non-cancelled Game 수를 목표치까지 채운다.
 * 부족분만큼 빈 doubles draft Game을 만들고 event_game_players는 생성하지
 * 않는다. 목표에 도달했거나 목표가 더 작으면 DML 없이 카운터만 반환한다.
 * 목표 수는 어디에도 저장하지 않는다(요청 인자 전용).
 */
export interface EnsureEventGameCountParams {
  p_event_id: string;
  p_club_id: string;
  /** 1 ~ 200. 상한 근거는 0061 migration 주석 참조. */
  p_target_count: number;
}

/** ensure_event_game_count의 반환 1행. created_count=0이면 데이터 변경이 없다. */
export interface EnsureEventGameCountRow {
  target_count: number;
  /** 호출 직전의 non-cancelled Game 수. */
  previous_count: number;
  created_count: number;
  /** previous_count + created_count. */
  final_count: number;
}

/**
 * update_event_slot_mode(0063) — events.match_config의 slot_mode 키 하나만
 * 원자적으로 교체한다. 다른 13개 키는 저장된 값 그대로 유지된다.
 * 같은 값으로 호출하면 DML 없이 changed=false로 반환한다.
 */
export interface UpdateEventSlotModeParams {
  p_event_id: string;
  p_club_id: string;
  /** DB canonical string만 허용 — 보정하지 않는다. */
  p_slot_mode: MatchSlotMode;
}

/** update_event_slot_mode의 반환 1행. */
export interface UpdateEventSlotModeRow {
  event_id: string;
  slot_mode: MatchSlotMode;
  /** 실제 변경이 있었으면 항상 null(스케줄 확정 무효화). */
  scheduling_confirmed_at: string | null;
  /** false면 요청값이 현재값과 같아 아무것도 바뀌지 않았다는 뜻. */
  changed: boolean;
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
