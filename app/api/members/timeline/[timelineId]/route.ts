import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { validateTimelinePayload, buildEventDate, ensureSingleHighlight } from "@/lib/member-timeline-validation";

interface UpdateTimelineBody {
  timelineType: string;
  /** 연도. 정책상 필수 — null은 "날짜를 전혀 모름"으로만 허용. */
  eventYear: number | null;
  /** 월(1~12). 선택값. */
  eventMonth: number | null;
  title: string;
  description?: string | null;
  /** 대회명 원본 (competition 타입). title 자동조립의 source. */
  competitionName?: string | null;
  /** 리그명 원본 (league 타입). title 자동조립의 source. */
  leagueName?: string | null;
  /** 직책 원본 (system 타입, 현재 비활성). title 자동조립의 source. */
  role?: string | null;
  association?: string | null;
  division?: string | null;
  result?: string | null;
  memo?: string | null;
  isHighlight?: boolean;
}

interface RouteParams {
  params: { timelineId: string };
}

/** Timeline 항목 수정. 운영진만 가능. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const timelineId = params.timelineId;
  const body = (await request.json()) as UpdateTimelineBody;
  const {
    timelineType,
    eventYear,
    eventMonth,
    title,
    description,
    competitionName,
    leagueName,
    role,
    association,
    division,
    result,
    memo,
    isHighlight,
  } = body;

  const normalizedAssociation = association ?? null;
  const normalizedDivision = division ?? null;
  const normalizedResult = result ?? null;
  const normalizedEventYear = eventYear ?? null;
  const normalizedEventMonth = eventMonth ?? null;

  const validationError = validateTimelinePayload(
    {
      timelineType,
      eventYear: normalizedEventYear,
      eventMonth: normalizedEventMonth,
      title,
      association: normalizedAssociation,
      division: normalizedDivision,
      result: normalizedResult,
    },
    // 수정(PUT)에서는 종류를 그대로 둔 채 다른 필드만 고치는 경우가 흔하므로
    // legacy 값(career/system/achievement/attendance)도 허용한다.
    { allowLegacyType: true }
  );
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 대표 커리어(is_highlight) 단일성 보장: true로 수정하는 경우에만,
  // 같은 회원의 다른 기존 대표를 먼저 끈다. PUT body에는 member_id가
  // 없으므로(row 자체에 이미 있는 값이라 수정 대상이 아님) 먼저 조회한다.
  // false로 두는 건 기존 대표에 영향이 없으니 이 단계 자체를 건너뛴다.
  if (isHighlight) {
    const { data: target, error: lookupError } = await supabase
      .from("member_timeline")
      .select("member_id")
      .eq("id", timelineId)
      .single();

    if (lookupError || !target) {
      return NextResponse.json({ error: "수정할 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    const { error: clearError } = await ensureSingleHighlight(supabase, target.member_id, timelineId);
    if (clearError) {
      return NextResponse.json({ error: "대표 커리어 갱신에 실패했습니다." }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("member_timeline")
    .update({
      timeline_type: timelineType,
      event_year: normalizedEventYear,
      event_month: normalizedEventMonth,
      // event_date는 event_year/event_month로부터 서버가 합성한 호환용 값.
      event_date: buildEventDate(normalizedEventYear, normalizedEventMonth),
      title: title.trim(),
      description: description?.trim() || null,
      competition_name: competitionName?.trim() || null,
      league_name: leagueName?.trim() || null,
      role: role?.trim() || null,
      association: normalizedAssociation,
      division: normalizedDivision,
      result: normalizedResult,
      memo: memo?.trim() || null,
      is_highlight: isHighlight ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timelineId)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "타임라인 수정에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: updated });
}

/** Timeline 항목 삭제. 운영진만 가능. 실제 이력 데이터라 soft delete 없이 바로 삭제한다. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const timelineId = params.timelineId;
  const supabase = createServiceClient();

  const { error: deleteError } = await supabase.from("member_timeline").delete().eq("id", timelineId);

  if (deleteError) {
    return NextResponse.json({ error: "타임라인 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
