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
  | "정회원"
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

export interface Member {
  id: string;
  name: string;
  nickname: string;
  /** @deprecated 0004부터 미사용. 실력 등급 — LP 시스템으로 대체됨. 신규 코드에서 참조하지 말 것. */
  grade: MemberGrade;
  role: MemberRole;
  phone: string | null;
  mapo_score: number | null;
  /** @deprecated 0004부터 미사용. ELO 레이팅 — league_point로 대체됨. 신규 코드에서 참조하지 말 것. */
  rating: number;
  wins: number;
  losses: number;
  is_active: boolean;
  member_type: MemberType;
  league_point: number;
  permission_role: PermissionRole;
  kakao_provider_id: string | null;
  is_kakao_linked: boolean;
  address_full: string | null;
  district: string | null;
  age: number | null;
  created_at: string;
}

export interface MemberWithStats extends Member {
  win_rate: number;
}

export interface Match {
  id: string;
  played_at: string;
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
}

/** 경기 화면에 표시할 선수 정보. 회원이든 게스트든 동일한 모양으로 다룬다. */
export interface MatchPlayerDisplay {
  id: string;
  nickname: string;
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

export interface PointHistory {
  id: string;
  match_id: string | null;
  member_id: string;
  point_before: number;
  point_after: number;
  point_change: number;
  reason: string;
  created_at: string;
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
  normalized_name: string | null;
  normalized_nickname: string | null;
  normalized_phone: string | null;
  normalized_address: string | null;
  normalized_district: string | null;
  normalized_age: number | null;
  normalized_mapo_score: number | null;
  normalized_member_type: string | null;
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
}

export interface Guest {
  id: string;
  name: string;
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
  created_at: string;
}

export interface GuestWithStats extends Guest {
  win_rate: number;
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
    };
    Views: {
      member_stats: {
        Row: MemberWithStats;
        Relationships: [];
      };
      guest_stats: {
        Row: GuestWithStats;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
