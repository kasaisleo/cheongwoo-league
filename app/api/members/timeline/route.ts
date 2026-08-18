import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  PUBLIC_TIMELINE_SELECT,
  type PublicMemberTimelineItem,
} from "@/lib/member-timeline-public";
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

/**
 * 특정 회원의 Timeline 전체 조회. 최신순(event_date 우선, 없으면 created_at).
 *
 * 공개 API다 — 로그인하지 않아도 호출할 수 있다. 그래서 Club scope를 서버에서
 * 강제한다(Phase 2A-8E-1E). 이전 계약은 memberId만 신뢰하고 service_role로
 * 조회했기 때문에, UUID만 알면 다른 Club 회원의 타임라인도 읽을 수 있었다.
 *
 * public의 Club context 정본은 URL slug 하나뿐이다. body/query의 club_id나
 * Admin 쿠키 컨텍스트(getAdminAccessServer / selected_club_id 등)는 쓰지 않는다.
 *
 * 회원 노출 조건은 공개 회원 상세(/c/[slug]/members/[id])와 같은 계약을
 * 재사용한다 — clubs.status='active' + get_public_member_detail RPC(club_id와
 * member_id를 동시에 강제하고 is_active=true / deleted_at is null만 반환).
 * 여기서 조건을 따로 만들면 두 화면의 노출 범위가 갈라진다.
 */
export async function GET(request: NextRequest) {
  const clubSlug = request.nextUrl.searchParams.get("clubSlug");
  const memberId = request.nextUrl.searchParams.get("memberId");

  if (!clubSlug) {
    return NextResponse.json({ error: "clubSlug가 필요합니다." }, { status: 400 });
  }
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  // 공개 조회 경로는 anon 클라이언트를 쓴다. RPC가 SECURITY DEFINER로
  // Club scope를 강제하므로 여기서 service_role을 꺼낼 이유가 없다.
  const publicClient = createClient();

  const { data: club } = await publicClient
    .from("clubs")
    .select("id")
    .eq("slug", clubSlug.trim())
    .eq("status", "active")
    .maybeSingle();

  // 존재하지 않는 Club과 존재하지 않는 회원을 같은 404로 돌려준다 —
  // 응답 차이로 "이 Club/회원은 존재한다"를 알아낼 수 없게 한다.
  const notFoundResponse = NextResponse.json(
    { error: "회원을 찾을 수 없습니다." },
    { status: 404 }
  );

  if (!club) return notFoundResponse;

  const { data: memberRows } = await publicClient.rpc("get_public_member_detail", {
    p_club_id: club.id,
    p_member_id: memberId,
  });

  const member = (memberRows ?? [])[0] as { id: string } | undefined;
  if (!member) return notFoundResponse;

  // 여기까지 왔으면 member는 이 Club 소속이고 공개 대상이다.
  // timeline 테이블은 0071로 anon 권한이 회수돼 service_role로만 읽는다.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("member_timeline")
    .select(PUBLIC_TIMELINE_SELECT)
    .eq("member_id", member.id)
    // event_date(호환용 합성 컬럼)로 정렬한다 — day는 항상 placeholder("01")라
    // 실제 날짜 의미는 없지만, 연/월 순서를 정렬하는 목적으로는 정확하다.
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "타임라인을 불러오지 못했습니다." }, { status: 500 });
  }

  const items = (data ?? []) as unknown as PublicMemberTimelineItem[];
  return NextResponse.json({ ok: true, items });
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
