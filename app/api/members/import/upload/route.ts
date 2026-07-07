import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { normalizeStagingRow, normalizePhone } from "@/lib/member-import";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * CSV/XLSX 파일을 업로드받아 파싱하고, staging_members에 저장한다.
 * members에는 직접 insert하지 않는다 — 반드시 staging_members → 검수 → members 순서.
 *
 * 컬럼 매칭은 헤더 이름 기준으로 한다(대소문자/공백 무시). 지원하는 헤더 이름:
 * 이름/name, 닉네임/nickname, 휴대폰/phone, 주소/address, 나이/age,
 * 출생연도/birth_year, 지역점수/mapo_score, 회원구분/member_type
 *
 * 권한(Step 8-3): owner 전용. 일괄 임포트는 회원 데이터를 대량으로 한 번에
 * 생성하는 작업이라 실수 시 영향 범위가 단건 등록보다 훨씬 크다.
 */

const HEADER_ALIASES: Record<string, string> = {
  이름: "name",
  name: "name",
  닉네임: "nickname",
  nickname: "nickname",
  휴대폰: "phone",
  휴대폰번호: "phone",
  phone: "phone",
  주소: "address",
  address: "address",
  나이: "age",
  age: "age",
  출생연도: "birth_year",
  생년: "birth_year",
  birth_year: "birth_year",
  마포점수: "mapo_score",
  마포구점수: "mapo_score",
  지역점수: "mapo_score",
  지역구점수: "mapo_score",
  mapo_score: "mapo_score",
  회원구분: "member_type",
  member_type: "member_type",
};

function normalizeHeader(header: string): string | null {
  const key = header.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[header.trim()] ?? null;
}

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.kakaoIsOwner) {
    return NextResponse.json(
      { error: "이 작업은 owner만 가능합니다." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해주세요." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let rows: Record<string, unknown>[];

  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    // raw:false — 셀의 "표시 텍스트"를 그대로 가져온다. 엑셀에서 숫자 서식으로
    // 저장된 휴대폰 번호(예: 1030643885)가 JS number로 들어와 선행 0 손실 여부를
    // 판단하기 어려워지는 것을 막기 위해, 항상 문자열 기준으로 다룬다.
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } catch {
    return NextResponse.json(
      { error: "파일을 읽을 수 없습니다. CSV 또는 XLSX 파일인지 확인해주세요." },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "파일에 데이터가 없습니다." }, { status: 400 });
  }

  // 첫 행의 헤더를 표준 필드명으로 매핑
  const sampleRow = rows[0];
  const headerMap = new Map<string, string>();
  for (const header of Object.keys(sampleRow)) {
    const mapped = normalizeHeader(header);
    if (mapped) headerMap.set(header, mapped);
  }

  if (!Array.from(headerMap.values()).includes("name")) {
    return NextResponse.json(
      { error: "이름 컬럼을 찾을 수 없습니다. 헤더에 '이름' 또는 'name'이 있는지 확인해주세요." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const currentClubId = await getCurrentClubId();

  // 새 파일 업로드 시작 — staging_members는 임시 작업 공간(working table)이다.
  // 이력 보존 용도로 쓰지 않으므로, 새 업로드 시작 시 기존 데이터를 전부 비운다.
  // (이미 members로 반영된 회원 정보는 members 테이블에 남아있으므로 staging에는
  // 보존할 필요가 없다.)
  await supabase.from("staging_members").delete().eq("club_id", currentClubId);

  // 기존 members의 phone 전체를 미리 가져와서 중복 검사에 사용
  const { data: existingMembers } = await supabase
    .from("members")
    .select("id, phone")
    .eq("club_id", currentClubId);
  const phoneToMemberId = new Map(
    (existingMembers ?? [])
      .filter((m) => m.phone)
      .map((m) => [normalizePhone(m.phone) ?? m.phone, m.id])
  );

  const stagingRows = rows
    .map((row) => {
      const get = (field: string): string | null => {
        for (const [header, mapped] of headerMap.entries()) {
          if (mapped === field) {
            const value = row[header];
            return value === undefined || value === null || value === "" ? null : String(value).trim();
          }
        }
        return null;
      };

      const raw = {
        raw_name: get("name"),
        raw_nickname: get("nickname"),
        raw_phone: get("phone"),
        raw_address: get("address"),
        raw_age: get("age"),
        raw_mapo_score: get("mapo_score"),
        raw_member_type: get("member_type"),
        raw_birth_year: get("birth_year"),
      };

      return raw;
    })
    // 이름과 전화번호가 둘 다 비어있는 행(CSV/XLSX 끝의 빈 줄 등)은 staging에 저장하지 않고 건너뛴다.
    .filter((raw) => raw.raw_name || raw.raw_phone)
    .map((raw) => {
      const normalized = normalizeStagingRow(raw);

      // phone 중복 검사 — 기존 members에 같은 번호가 있으면 duplicate로 표시
      let existingMemberId: string | null = null;
      if (normalized.normalized_phone && phoneToMemberId.has(normalized.normalized_phone)) {
        existingMemberId = phoneToMemberId.get(normalized.normalized_phone) ?? null;
        normalized.validation_status = "duplicate";
      }

      return {
        ...raw,
        ...normalized,
        club_id: currentClubId,
        existing_member_id: existingMemberId,
      };
    });

  // 업로드 파일 내부에서도 phone이 중복되는 행이 있으면 두 번째 이후는 duplicate 처리
  const seenPhones = new Set<string>();
  for (const row of stagingRows) {
    if (!row.normalized_phone) continue;
    if (seenPhones.has(row.normalized_phone)) {
      row.validation_status = "duplicate";
    } else {
      seenPhones.add(row.normalized_phone);
    }
  }

  if (stagingRows.length === 0) {
    return NextResponse.json(
      { error: "유효한 데이터가 없습니다. 이름 또는 휴대폰 번호가 있는 행이 하나도 없어요." },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("staging_members")
    .insert(stagingRows)
    .select();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "데이터 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: inserted.length, batchIds: inserted.map((r) => r.id) });
}
