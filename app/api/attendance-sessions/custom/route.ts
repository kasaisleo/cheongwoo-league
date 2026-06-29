import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { Member, SessionDay } from "@/lib/supabase/database.types";

interface CreateCustomSessionBody {
  sessionDate: string;
  sessionDay: SessionDay;
  title: string;
}

export async function POST(request: NextRequest) {
  // manager 이상이 수행해야 하지만, 권한 시스템 도입 전 단계라 운영진 인증으로 대체.
  const authError = requireAdmin();
  if (authError) return authError;

  const body = (await request.json()) as CreateCustomSessionBody;
  const { sessionDate, sessionDay, title } = body;

  if (!sessionDate) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }
  const todayString = new Date().toISOString().slice(0, 10);
  if (sessionDate < todayString) {
    return NextResponse.json(
      { error: "오늘 이전 날짜는 선택할 수 없습니다." },
      { status: 400 }
    );
  }
  if (sessionDay !== "holiday" && sessionDay !== "custom") {
    return NextResponse.json({ error: "운동 구분을 선택해주세요." }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 같은 날짜+구분으로 이미 open 세션이 있는지 확인 (중복 생성 방지)
  const { data: existingOpen } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("session_date", sessionDate)
    .eq("session_day", sessionDay)
    .eq("status", "open")
    .limit(1);

  if (existingOpen && existingOpen.length > 0) {
    return NextResponse.json(
      { error: "이미 해당 날짜의 출석 세션이 있습니다." },
      { status: 409 }
    );
  }

  const { data: session, error: insertError } = await supabase
    .from("attendance_sessions")
    .insert({
      session_date: sessionDate,
      session_day: sessionDay,
      title: title.trim(),
      status: "open",
    })
    .select()
    .single();

  if (insertError || !session) {
    return NextResponse.json({ error: "세션 생성에 실패했습니다." }, { status: 500 });
  }

  const { data: activeMembers } = await supabase
    .from("members")
    .select("id")
    .eq("is_active", true);

  const members = (activeMembers ?? []) as Pick<Member, "id">[];

  if (members.length > 0) {
    await supabase.from("attendance").insert(
      members.map((m) => ({
        member_id: m.id,
        session_id: session.id,
        event_date: session.session_date,
        status: "undecided" as const,
      }))
    );
  }

  return NextResponse.json({ ok: true, session });
}
