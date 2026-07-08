import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { isValidPlayerBackground } from "@/lib/constants/member-timeline";
import type { MemberGrade, MemberRole } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

interface UpdateMemberBody {
  name?: string;
  nickname?: string | null;
  phone?: string;
  age?: number | null;
  addressFull?: string | null;
  district?: string | null;
  grade?: MemberGrade;
  mapoScore?: number | null;
  /** ?댁쁺 吏곸콉. null?대㈃ 吏곸콉 ?놁쓬?쇰줈 蹂寃? */
  role?: MemberRole | null;
  /** ?대㈃?뚯썝 ?щ?. is_active(??젣/?④?)? 蹂꾧컻 ??false???쒕룞, true???대㈃. */
  isDormant?: boolean;
  memo?: string | null;
  playerBackground?: string;
}

const VALID_GRADES: MemberGrade[] = ["A", "B", "C", "D"];
const VALID_ROLES: MemberRole[] = [
  "?뚯옣",
  "遺?뚯옣",
  "珥앸Т",
  "寃쎄린?댁궗",
  "?띾낫?댁궗",
  "?댁쁺?댁궗",
  "??쇅?댁궗",
  "怨좊Ц",
];

/** 010?쇰줈 ?쒖옉?섎뒗 ?レ옄留?11?먮━ */
const PHONE_REGEX = /^010\d{8}$/;

interface RouteParams {
  params: { id: string };
}

/**
 * ?뚯썝 ?뺣낫 ?섏젙. manager ?댁긽 媛??
 * 異뷀썑 移댁뭅??濡쒓렇???꾩엯 ?? 蹂몄씤? ?먯떊???뺣낫瑜??섏젙?????덇쾶 ?덉슜 ?덉젙.
 *
 * ?섏젙 媛????ぉ: ?대쫫, ?됰꽕?? ?꾪솕踰덊샇, ?섏씠, 二쇱냼, district, grade, 吏??젏??
 * 吏곸콉(role), ?대㈃ ?щ?(isDormant), 硫붾え, ?좎닔異쒖떊. 洹?????ぉ(?뚯썝援щ텇/LP/?뱁뙣 ???
 * ??API????곸씠 ?꾨땲??
 *
 * 沅뚰븳 ?몃텇??Step 8-3): 吏곸콉(role)留?owner ?꾩슜?대떎. body??role ?꾨뱶媛
 * ?ы븿?섏뼱 ?덈뒗??owner媛 ?꾨땲硫? 洹??꾨뱶留?議곗슜??臾댁떆?섏? ?딄퀬 ?붿껌
 * ?꾩껜瑜?403?쇰줈 嫄곕??쒕떎 ??沅뚰븳 ?녿뒗 ?꾨뱶 蹂寃??쒕룄瑜?紐낇솗?섍쾶 ?ㅽ뙣?쒖폒?? * "??μ? ?먮뒗??吏곸콉留???諛붾뚯뿀?????쇰???留됱쓣 ???덇퀬, ?붾쾭源?QA?? * ?ъ썙吏꾨떎. ??泥댄겕??DB 議고쉶蹂대떎 癒쇱? ?섑뻾??遺遺?泥섎━媛 ?앷린吏 ?딄쾶 ?쒕떎.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const putAccess = await getAdminAccessServer();
  if (!putAccess.kakaoIsAdmin) return Response.json({ error: "愿由ъ옄 沅뚰븳???꾩슂?⑸땲??" }, { status: 403 });

  const memberId = params.id;
  const body = (await request.json()) as UpdateMemberBody;
  const {
    name,
    nickname,
    phone,
    age,
    addressFull,
    district,
    grade,
    mapoScore,
    role,
    isDormant,
    memo,
    playerBackground,
  } = body;

  // role(吏곸콉) 蹂寃쎌? owner ?꾩슜. body??role ???먯껜媛 ?덉쑝硫?null濡?吏곸콉??  // ?댁젣?섎뒗 寃쎌슦???ы븿) owner ?щ?瑜??뺤씤?쒕떎 ??manager媛 role: null??  // 蹂대궡 吏곸콉??吏?곕뒗 寃껊룄 留됱븘???섎?濡?"媛믪씠 truthy?몄?"媛 ?꾨땲??  // "?꾨뱶媛 議댁옱?섎뒗吏"濡??먮떒?쒕떎.
  if (role !== undefined && !putAccess.kakaoIsOwner) {
    return NextResponse.json(
      { error: "吏곸콉 蹂寃쎌? 理쒓퀬愿由ъ옄留?媛?ν빀?덈떎." },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  const { data: existingMember, error: fetchError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .single();

  if (fetchError || !existingMember) {
    return NextResponse.json({ error: "?뚯썝??李얠쓣 ???놁뒿?덈떎." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let trimmedName: string | null = null;

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "?대쫫???낅젰?댁＜?몄슂." }, { status: 400 });
    }
    trimmedName = name.trim();
    updates.name = trimmedName;
  }

  if (nickname !== undefined) {
    updates.nickname = nickname?.trim() || trimmedName || existingMember.name;
  }

  if (phone !== undefined) {
    if (!phone.trim()) {
      return NextResponse.json({ error: "?대???踰덊샇瑜??낅젰?댁＜?몄슂." }, { status: 400 });
    }
    const digitsOnlyPhone = phone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digitsOnlyPhone)) {
      return NextResponse.json(
        { error: "?대???踰덊샇??010?쇰줈 ?쒖옉?섎뒗 11?먮━?ъ빞 ?⑸땲??" },
        { status: 400 }
      );
    }

    // phone 以묐났 泥댄겕 ??蹂몄씤? ?쒖쇅
    const { data: duplicateCheck } = await supabase
      .from("members")
      .select("id")
      .eq("phone", digitsOnlyPhone)
      .eq("club_id", currentClubId)
      .neq("id", memberId)
      .limit(1);

    if (duplicateCheck && duplicateCheck.length > 0) {
      return NextResponse.json(
        { error: "?대? ?깅줉???대???踰덊샇?낅땲??" },
        { status: 409 }
      );
    }

    updates.phone = digitsOnlyPhone;
  }

  if (age !== undefined) {
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
      return NextResponse.json({ error: "?섏씠???レ옄留??낅젰?댁＜?몄슂." }, { status: 400 });
    }
    updates.age = age;
  }

  if (addressFull !== undefined) {
    updates.address_full = addressFull?.trim() || null;
  }

  if (district !== undefined) {
    updates.district = district?.trim() || null;
  }

  if (grade !== undefined) {
    if (!VALID_GRADES.includes(grade)) {
      return NextResponse.json({ error: "?ㅻ젰 ?깃툒???щ컮瑜댁? ?딆뒿?덈떎." }, { status: 400 });
    }
    updates.grade = grade;
  }

  if (mapoScore !== undefined) {
    if (mapoScore !== null && (!Number.isInteger(mapoScore) || mapoScore < 1 || mapoScore > 10)) {
      return NextResponse.json(
        { error: "吏??젏?섎뒗 1~10 ?ъ씠?ъ빞 ?⑸땲??" },
        { status: 400 }
      );
    }
    updates.mapo_score = mapoScore;
  }

  if (role !== undefined) {
    // role? 吏곸콉???놁쑝硫?null ??洹??먯껜濡??좏슚?섎떎(QA 耳?댁뒪: 吏곸콉 ?덉쓬 ???놁쓬).
    // 媛믪씠 ?덉쓣 ?뚮쭔 VALID_ROLES濡?寃利앺븳??
    if (role !== null && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "吏곸콉???щ컮瑜댁? ?딆뒿?덈떎." }, { status: 400 });
    }
    updates.role = role;
  }

  if (isDormant !== undefined) {
    if (typeof isDormant !== "boolean") {
      return NextResponse.json({ error: "?대㈃ ?щ?媛 ?щ컮瑜댁? ?딆뒿?덈떎." }, { status: 400 });
    }
    updates.is_dormant = isDormant;
  }

  if (memo !== undefined) {
    updates.memo = memo?.trim() || null;
  }

  if (playerBackground !== undefined) {
    if (!isValidPlayerBackground(playerBackground)) {
      return NextResponse.json({ error: "?좎닔異쒖떊 ?뺣낫媛 ?щ컮瑜댁? ?딆뒿?덈떎." }, { status: 400 });
    }
    updates.player_background = playerBackground;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "?섏젙???댁슜???놁뒿?덈떎." }, { status: 400 });
  }

  const { data: updatedMember, error: updateError } = await supabase
    .from("members")
    .update(updates)
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .select()
    .single();

  if (updateError || !updatedMember) {
    return NextResponse.json({ error: "?뚯썝 ?뺣낫 ?섏젙???ㅽ뙣?덉뒿?덈떎." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member: updatedMember });
}

/**
 * ?뚯썝 soft delete. ?ㅼ젣濡??됱쓣 吏?곗? ?딄퀬 is_active=false濡쒕쭔 ?쒖떆?쒕떎.
 * 寃쎄린/異쒖꽍/LP ?대젰? member_id濡??곌껐?섏뼱 ?덉뼱 洹몃?濡?蹂댁〈?쒕떎.
 *
 * 沅뚰븳(Step 8-3): owner ?꾩슜. soft delete?쇰룄 ?뚯썝??紐⑤뱺 ?붾㈃?먯꽌 利됱떆
 * ?щ씪吏??媛???뚭툒?????숈옉?닿퀬, 蹂듦뎄 API/UI媛 ?놁뼱 ?좎쨷?⑥씠 ?꾩슂?섎떎.
 * 異뷀썑 移댁뭅??濡쒓렇???꾩엯 ?쒖뿉??蹂몄씤 ??젣???덉슜?섏? ?딅뒗??????긽 owner留?媛??
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) return Response.json({ error: "?뚯썝 ?덊눜 泥섎━??master/owner留?媛?ν빀?덈떎." }, { status: 403 });

  const memberId = params.id;
  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  const { data: existingMember, error: fetchError } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("club_id", currentClubId)
    .single();

  if (fetchError || !existingMember) {
    return NextResponse.json({ error: "?뚯썝??李얠쓣 ???놁뒿?덈떎." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("members")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("club_id", currentClubId);

  if (updateError) {
    return NextResponse.json({ error: "?뚯썝 ??젣???ㅽ뙣?덉뒿?덈떎." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
