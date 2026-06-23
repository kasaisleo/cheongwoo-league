// Supabase 스키마 기반 타입 정의
// 실제 운영 환경에서는 `supabase gen types typescript --linked`로 생성한 파일로 교체 권장.

export type MemberGrade = "A" | "B" | "C" | "D";
export type AttendanceStatus = "attending" | "absent" | "undecided";
export type WinnerTeam = "A" | "B";

export interface Member {
  id: string;
  name: string;
  nickname: string;
  grade: MemberGrade;
  rating: number;
  wins: number;
  losses: number;
  is_active: boolean;
  created_at: string;
}

export interface MemberWithStats extends Member {
  win_rate: number;
}

export interface Match {
  id: string;
  played_at: string;
  team_a_player1: string;
  team_a_player2: string;
  team_b_player1: string;
  team_b_player2: string;
  score_a: number;
  score_b: number;
  winner_team: WinnerTeam;
  created_by: string | null;
  created_at: string;
}

export interface MatchWithPlayers extends Match {
  team_a_player1_member: Member;
  team_a_player2_member: Member;
  team_b_player1_member: Member;
  team_b_player2_member: Member;
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

export interface Attendance {
  id: string;
  member_id: string;
  event_date: string;
  status: AttendanceStatus;
  updated_at: string;
}

export interface Guest {
  id: string;
  name: string;
  referred_by: string | null;
  visit_date: string;
  skill_grade: MemberGrade | null;
  manner_score: number | null;
  reinvite: boolean | null;
  notes: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: Partial<Member> & { name: string; nickname: string; grade: MemberGrade };
        Update: Partial<Member>;
      };
      matches: {
        Row: Match;
        Insert: Partial<Match> & {
          team_a_player1: string;
          team_a_player2: string;
          team_b_player1: string;
          team_b_player2: string;
          score_a: number;
          score_b: number;
          winner_team: WinnerTeam;
        };
        Update: Partial<Match>;
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
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance> & { member_id: string; event_date: string; status: AttendanceStatus };
        Update: Partial<Attendance>;
      };
      guests: {
        Row: Guest;
        Insert: Partial<Guest> & { name: string; visit_date: string };
        Update: Partial<Guest>;
      };
    };
    Views: {
      member_stats: {
        Row: MemberWithStats;
      };
    };
  };
}
