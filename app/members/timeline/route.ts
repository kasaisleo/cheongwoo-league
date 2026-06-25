import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";
import { validateTimelinePayload } from "@/lib/member-timeline-validation";

interface CreateTimelineBody {
  memberId: string;
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

/** 특정 회원의 Timeline 전체 조회. 최신순(event_date 우선, 없으면 created_at). */
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("member_timeline")
    .select("*")
    .eq("member_id", memberId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "타임라인을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

/** Timeline 항목 생성. 운영진만 가능. */
export async function POST(request: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as CreateTimelineBody;
  const {
    memberId,
    timelineType,
    eventDate,
    title,
    description,
    association,
    division,
    result,
    memo,
    isHighlight,
  } = body;

  if (!memberId) {
    return NextResponse.json({ error: "회원 정보가 올바르지 않습니다." }, { status: 400 });
  }

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

  const { data: inserted, error: insertError } = await supabase
    .from("member_timeline")
    .insert({
      member_id: memberId,
      timeline_type: timelineType,
      event_date: eventDate ?? null,
      title: title.trim(),
      description: description?.trim() || null,
      association: normalizedAssociation,
      division: normalizedDivision,
      result: normalizedResult,
      memo: memo?.trim() || null,
      is_highlight: isHighlight ?? false,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "타임라인 추가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: inserted });
}
