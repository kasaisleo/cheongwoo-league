import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { validateTimelinePayload } from "@/lib/member-timeline-validation";

interface UpdateTimelineBody {
  timelineType: string;
  eventDate: string | null;
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
  const { timelineType, eventDate, title, description, association, division, result, memo, isHighlight } =
    body;

  const normalizedAssociation = association ?? null;
  const normalizedDivision = division ?? null;
  const normalizedResult = result ?? null;

  const validationError = validateTimelinePayload({
    timelineType,
    eventDate: eventDate ?? null,
    title,
    association: normalizedAssociation,
    division: normalizedDivision,
    result: normalizedResult,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: updated, error: updateError } = await supabase
    .from("member_timeline")
    .update({
      timeline_type: timelineType,
      event_date: eventDate ?? null,
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
