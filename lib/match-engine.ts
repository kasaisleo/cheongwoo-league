import { createServiceClient } from "@/lib/supabase/server";
import type { Match, Member, Guest } from "@/lib/supabase/database.types";

/** 일반 경기 승리 시 적용되는 리그 포인트 */
export const LEAGUE_POINT_WIN = 10;

/**
 * applyMatch/rollbackMatch/extractPlayerSlots가 실제로 참조하는 필드만 정의한
 * 최소 입력 타입. played_at/score/tiebreak/session_id/created_at/created_by는
 * 여기서 절대 참조하지 않는다 — 호출부가 select("*") 없이 이 필드들만 select해도
 * 안전함을 타입으로 보장한다.
 */
export type MatchRatingInput = Pick<
  Match,
  | "id"
  | "club_id"
  | "winner_team"
  | "team_a_player1_member"
  | "team_a_player1_guest"
  | "team_a_player2_member"
  | "team_a_player2_guest"
  | "team_b_player1_member"
  | "team_b_player1_guest"
  | "team_b_player2_member"
  | "team_b_player2_guest"
>;

export interface MatchPlayerSlot {
  prefix: string;
  isGuest: boolean;
  id: string;
  won: boolean;
}

export function extractPlayerSlots(match: MatchRatingInput): MatchPlayerSlot[] {
  const teamAWon = match.winner_team === "A";
  const teamBWon = match.winner_team === "B";

  const rawSlots: { prefix: string; memberId: string | null; guestId: string | null; won: boolean }[] = [
    {
      prefix: "team_a_player1",
      memberId: match.team_a_player1_member,
      guestId: match.team_a_player1_guest,
      won: teamAWon,
    },
    {
      prefix: "team_a_player2",
      memberId: match.team_a_player2_member,
      guestId: match.team_a_player2_guest,
      won: teamAWon,
    },
    {
      prefix: "team_b_player1",
      memberId: match.team_b_player1_member,
      guestId: match.team_b_player1_guest,
      won: teamBWon,
    },
    {
      prefix: "team_b_player2",
      memberId: match.team_b_player2_member,
      guestId: match.team_b_player2_guest,
      won: teamBWon,
    },
  ];

  return rawSlots.map(({ prefix, memberId, guestId, won }) => {
    const isGuest = guestId !== null;
    return {
      prefix,
      isGuest,
      id: isGuest ? guestId! : memberId!,
      won,
    };
  });
}

export async function applyMatch(
  supabase: ReturnType<typeof createServiceClient>,
  match: MatchRatingInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clubId = match.club_id;

  if (!clubId) {
    return { ok: false, error: "match.club_id is required" };
  }

  const slots = extractPlayerSlots(match);

  const memberIds = slots.filter((s) => !s.isGuest).map((s) => s.id);
  const guestIds = slots.filter((s) => s.isGuest).map((s) => s.id);

  let memberRows: Member[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .in("id", memberIds)
      .eq("club_id", clubId);

    memberRows = data ?? [];
  }

  let guestRows: Guest[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase
      .from("guests")
      .select("*")
      .in("id", guestIds)
      .eq("club_id", clubId);

    guestRows = data ?? [];
  }

  const memberById = new Map<string, Member>(memberRows.map((m) => [m.id, m]));
  const guestById = new Map<string, Guest>(guestRows.map((g) => [g.id, g]));

  for (const slot of slots) {
    if (slot.isGuest) {
      const guest = guestById.get(slot.id);
      if (!guest) continue;

      await supabase
        .from("guests")
        .update({
          wins: guest.wins + (slot.won ? 1 : 0),
          losses: guest.losses + (slot.won ? 0 : 1),
        })
        .eq("id", guest.id)
        .eq("club_id", clubId);

      continue;
    }

    const member = memberById.get(slot.id);
    if (!member) continue;

    const pointBefore = member.league_point;
    const pointChange = slot.won ? LEAGUE_POINT_WIN : 0;
    const pointAfter = pointBefore + pointChange;

    await supabase
      .from("members")
      .update({
        league_point: pointAfter,
        wins: member.wins + (slot.won ? 1 : 0),
        losses: member.losses + (slot.won ? 0 : 1),
      })
      .eq("id", member.id)
      .eq("club_id", clubId);

    await supabase.from("point_history").insert({
      match_id: match.id,
      member_id: member.id,
      club_id: clubId,
      point_before: pointBefore,
      point_after: pointAfter,
      point_change: pointChange,
      reason: slot.won ? "regular_match_win" : "regular_match_loss",
    });
  }

  return { ok: true };
}

export async function rollbackMatch(
  supabase: ReturnType<typeof createServiceClient>,
  match: MatchRatingInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clubId = match.club_id;

  if (!clubId) {
    return { ok: false, error: "match.club_id is required" };
  }

  const slots = extractPlayerSlots(match);

  const memberIds = slots.filter((s) => !s.isGuest).map((s) => s.id);
  const guestIds = slots.filter((s) => s.isGuest).map((s) => s.id);

  let memberRows: Member[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .in("id", memberIds)
      .eq("club_id", clubId);

    memberRows = data ?? [];
  }

  let guestRows: Guest[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase
      .from("guests")
      .select("*")
      .in("id", guestIds)
      .eq("club_id", clubId);

    guestRows = data ?? [];
  }

  const memberById = new Map<string, Member>(memberRows.map((m) => [m.id, m]));
  const guestById = new Map<string, Guest>(guestRows.map((g) => [g.id, g]));

  for (const slot of slots) {
    if (slot.isGuest) {
      const guest = guestById.get(slot.id);
      if (!guest) continue;

      await supabase
        .from("guests")
        .update({
          wins: Math.max(0, guest.wins - (slot.won ? 1 : 0)),
          losses: Math.max(0, guest.losses - (slot.won ? 0 : 1)),
        })
        .eq("id", guest.id)
        .eq("club_id", clubId);

      continue;
    }

    const member = memberById.get(slot.id);
    if (!member) continue;

    const pointChangeToUndo = slot.won ? LEAGUE_POINT_WIN : 0;
    const pointBefore = member.league_point;
    const pointAfter = pointBefore - pointChangeToUndo;

    await supabase
      .from("members")
      .update({
        league_point: pointAfter,
        wins: Math.max(0, member.wins - (slot.won ? 1 : 0)),
        losses: Math.max(0, member.losses - (slot.won ? 0 : 1)),
      })
      .eq("id", member.id)
      .eq("club_id", clubId);

    if (pointChangeToUndo !== 0) {
      await supabase.from("point_history").insert({
        match_id: match.id,
        member_id: member.id,
        club_id: clubId,
        point_before: pointBefore,
        point_after: pointAfter,
        point_change: -pointChangeToUndo,
        reason: "regular_match_rollback",
      });
    }
  }

  return { ok: true };
}