import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { validateTimelinePayload, buildEventDate, ensureSingleHighlight } from "@/lib/member-timeline-validation";

interface CreateTimelineBody {
  memberId: string;
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
    // event_date(호환용 합성 컬럼)로 정렬한다 — day는 항상 placeholder("01")라
    // 실제 날짜 의미는 없지만, 연/월 순서를 정렬하는 목적으로는 정확하다.
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "타임라인을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

/** Timeline 항목 생성. 운영진만 가능. */
export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsAdmin) {
    return NextResponse.json(
      { error: "운영진 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as CreateTimelineBody;
  const {
    memberId,
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

  if (!memberId) {
    return NextResponse.json({ error: "회원 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const normalizedAssociation = association ?? null;
  const normalizedDivision = division ?? null;
  const normalizedResult = result ?? null;
  const normalizedEventYear = eventYear ?? null;
  const normalizedEventMonth = eventMonth ?? null;

  const validationError = validateTimelinePayload({
    timelineType,
    eventYear: normalizedEventYear,
    eventMonth: normalizedEventMonth,
    title,
    association: normalizedAssociation,
    division: normalizedDivision,
    result: normalizedResult,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 대표 커리어(is_highlight) 단일성 보장: true로 새로 만드는 경우에만,
  // 같은 회원의 기존 대표를 먼저 끈다. false로 만드는 건 기존 대표에
  // 영향이 없으니 건드리지 않는다. 신규 생성이라 아직 자기 자신의 id가
  // 없으므로 excludeId는 넘기지 않는다.
  if (isHighlight) {
    const { error: clearError } = await ensureSingleHighlight(supabase, memberId);
    if (clearError) {
      return NextResponse.json({ error: "대표 커리어 갱신에 실패했습니다." }, { status: 500 });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("member_timeline")
    .insert({
      member_id: memberId,
      timeline_type: timelineType,
      event_year: normalizedEventYear,
      event_month: normalizedEventMonth,
      // event_date는 event_year/event_month로부터 서버가 합성한 호환용 값.
      // 정렬·과거 코드 호환 목적일 뿐, 화면 표시나 "월을 아는지" 판단에는
      // 쓰지 않는다(그건 event_year/event_month가 직접 갖고 있다).
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
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "타임라인 추가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: inserted });
}
