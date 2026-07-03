import { createServiceClient } from "@/lib/supabase/server";
import type { Match, Member, Guest } from "@/lib/supabase/database.types";

/** 일반 경기 승리 시 적용되는 리그 포인트 */
export const LEAGUE_POINT_WIN = 10;

type MatchWithClubId = Match & {
  club_id?: string | null;
};

export interface MatchPlayerSlot {
  prefix: string;
  isGuest: boolean;
  id: string;
  won: boolean;
}

function getMatchClubId(match: Match): string | null {
  return (match as MatchWithClubId).club_id ?? null;
}

export function extractPlayerSlots(match: Match): MatchPlayerSlot[] {
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
  match: Match
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clubId = getMatchClubId(match);

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
  match: Match
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clubId = getMatchClubId(match);

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
        point_before: pointBefore,
        point_after: pointAfter,
        point_change: -pointChangeToUndo,
        reason: "regular_match_rollback",
      });
    }
  }

  return { ok: true };
}