import { createServiceClient } from "@/lib/supabase/server";
import type { Match, Member, Guest } from "@/lib/supabase/database.types";

/** 일반 경기 승리 시 적립되는 LP. 패배는 변화 없음. */
export const LEAGUE_POINT_WIN = 10;

export interface MatchPlayerSlot {
  /** matches 테이블의 컬럼명 접두사. 예: "team_a_player1" */
  prefix: string;
  isGuest: boolean;
  id: string;
  /** 이 슬롯이 승리팀에 속하는지 */
  won: boolean;
}

/** Match row에서 4개 선수 슬롯을 일관된 형태로 추출한다. */
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

/**
 * 경기 1건이 회원/게스트에게 미친 효과(wins/losses, league_point, point_history)를
 * 적용한다. 경기 생성 시 호출한다.
 */
export async function applyMatch(
  supabase: ReturnType<typeof createServiceClient>,
  match: Match
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slots = extractPlayerSlots(match);

  const memberIds = slots.filter((s) => !s.isGuest).map((s) => s.id);
  const guestIds = slots.filter((s) => s.isGuest).map((s) => s.id);

  let memberRows: Member[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from("members").select("*").in("id", memberIds);
    memberRows = data ?? [];
  }

  let guestRows: Guest[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase.from("guests").select("*").in("id", guestIds);
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
        .eq("id", guest.id);
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
      .eq("id", member.id);

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

/**
 * 경기 1건이 회원/게스트에게 미쳤던 효과를 정확히 되돌린다.
 * 경기 수정(수정 전 되돌리기) 또는 삭제 시 호출한다.
 *
 * 되돌리는 방식: wins/losses를 -1, league_point를 그 경기로 인해 변동된 만큼 차감.
 * point_history에는 원래 기록을 삭제하지 않고, 되돌림을 나타내는 음수 보정
 * 레코드를 추가한다(reason: regular_match_rollback) — 이력 자체를 지우지 않기 위함.
 */
export async function rollbackMatch(
  supabase: ReturnType<typeof createServiceClient>,
  match: Match
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slots = extractPlayerSlots(match);

  const memberIds = slots.filter((s) => !s.isGuest).map((s) => s.id);
  const guestIds = slots.filter((s) => s.isGuest).map((s) => s.id);

  let memberRows: Member[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from("members").select("*").in("id", memberIds);
    memberRows = data ?? [];
  }

  let guestRows: Guest[] = [];
  if (guestIds.length > 0) {
    const { data } = await supabase.from("guests").select("*").in("id", guestIds);
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
        .eq("id", guest.id);
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
      .eq("id", member.id);

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
