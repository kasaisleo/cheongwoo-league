import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { validateTimelinePayload, buildEventDate } from "@/lib/member-timeline-validation";

interface UpdateTimelineBody {
  timelineType: string;
  /** 연도. 정책상 필수 — null은 "날짜를 전혀 모름"으로만 허용. */
  eventYear: number | null;
  /** 월(1~12). 선택값. */
  eventMonth: number | null;
  title: string;
  description?: string | null;
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
  const { timelineType, eventYear, eventMonth, title, description, association, division, result, memo, isHighlight } =
    body;

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
