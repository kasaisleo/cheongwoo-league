"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import type { StagingMember } from "@/lib/supabase/database.types";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  valid: "신규(반영 가능)",
  duplicate: "중복",
  missing_required: "필수값 누락",
  invalid_phone: "전화번호 오류",
  invalid_mapo_score: "마포점수 오류",
  needs_review: "확인 필요",
  imported: "반영 완료",
  skipped: "제외됨",
};

function statusTone(status: string): "court" | "fault" | "amber" | "neutral" {
  if (status === "valid") return "court";
  if (status === "imported") return "neutral";
  if (status === "duplicate" || status === "missing_required" || status === "invalid_phone" || status === "invalid_mapo_score") {
    return "fault";
  }
  return "amber";
}

export default function MemberImportPageClient() {
  const [rows, setRows] = useState<StagingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function loadStaging() {
    setLoading(true);
    const res = await fetch("/api/members/import/staging");
    const body = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      toast.error(body?.error ?? "목록을 불러오지 못했습니다.");
      return;
    }
    setRows(body.rows ?? []);
  }

  useEffect(() => {
    loadStaging();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/members/import/upload", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      toast.error(body?.error ?? "파일 업로드에 실패했습니다.");
      return;
    }

    toast.success(`${body.count}건을 불러왔습니다. 아래에서 검수해주세요.`);
    loadStaging();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllValid() {
    setSelectedIds(new Set(rows.filter((r) => r.validation_status === "valid").map((r) => r.id)));
  }

  async function handleCommit() {
    if (selectedIds.size === 0) {
      toast.error("반영할 회원을 선택해주세요.");
      return;
    }

    if (!window.confirm(`선택한 ${selectedIds.size}명을 회원으로 등록하시겠습니까?`)) return;

    setCommitting(true);
    const res = await fetch("/api/members/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stagingIds: Array.from(selectedIds) }),
    });
    const body = await res.json().catch(() => null);
    setCommitting(false);

    if (!res.ok) {
      toast.error(body?.error ?? "반영에 실패했습니다.");
      return;
    }

    toast.success(`${body.importedCount}명이 회원으로 등록되었습니다.`);
    setSelectedIds(new Set());
    loadStaging();
  }

  const pendingRows = rows.filter((r) => r.validation_status !== "imported");
  const importedCount = rows.length - pendingRows.length;

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          Member Import
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          회원 명단 가져오기
        </h1>
      </header>

      <Card className="mb-4 space-y-3 p-4">
        <p className="text-sm font-bold text-clay-400">1. 파일 업로드</p>
        <p className="text-xs text-line-500">
          CSV 또는 XLSX 파일. 헤더에 이름/닉네임/휴대폰/주소/나이/출생연도/마포점수/회원구분 중 필요한 컬럼이 있으면 됩니다.
        </p>
        <label className="block">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-line-700"
          />
        </label>
        {uploading && <p className="text-xs text-line-400">업로드 중...</p>}
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-clay-400">
          2. 검수 ({pendingRows.length}건 대기{importedCount > 0 ? `, ${importedCount}건 반영완료` : ""})
        </p>
        <button type="button" onClick={selectAllValid} className="text-xs font-semibold text-clay-400">
          신규 전체 선택
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : pendingRows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">업로드된 명단이 없어요.</Card>
      ) : (
        <div className="space-y-2">
          {pendingRows.map((row) => {
            const canSelect = row.validation_status === "valid";
            return (
              <Card key={row.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      disabled={!canSelect}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-line-900">
                        {row.normalized_name ?? row.raw_name ?? "(이름 없음)"}
                        {row.normalized_nickname && row.normalized_nickname !== row.normalized_name && (
                          <span className="ml-1 text-xs text-line-500">({row.normalized_nickname})</span>
                        )}
                      </p>
                      <p className="text-xs text-line-500">{row.normalized_phone ?? row.raw_phone ?? "휴대폰 없음"}</p>
                    </div>
                  </div>
                  <Badge tone={statusTone(row.validation_status)}>
                    {STATUS_LABEL[row.validation_status] ?? row.validation_status}
                  </Badge>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-line-500">
                  <div>
                    주소: {row.normalized_address ?? "—"}
                    {row.normalized_district && ` (${row.normalized_district})`}
                  </div>
                  <div>마포점수: {row.normalized_mapo_score ?? "—"}</div>
                  <div>
                    원본 나이:{" "}
                    {row.raw_age || row.raw_birth_year
                      ? [row.raw_age, row.raw_birth_year ? `출생연도 ${row.raw_birth_year}` : null]
                          .filter(Boolean)
                          .join(" / ")
                      : "—"}
                  </div>
                  <div className="font-semibold text-clay-400">
                    보정 나이: {row.corrected_age ?? "—"}
                  </div>
                </div>

                {row.validation_errors && (
                  <p className="mt-2 text-xs text-fault-400">{row.validation_errors}</p>
                )}
                {row.validation_status === "duplicate" && row.existing_member_id && (
                  <p className="mt-1 text-xs text-amber-400">
                    이미 등록된 회원과 휴대폰 번호가 같습니다.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {pendingRows.length > 0 && (
        <button
          type="button"
          disabled={committing || selectedIds.size === 0}
          onClick={handleCommit}
          className="mt-4 h-12 w-full rounded-lg bg-clay-400 text-sm font-bold text-line-25 disabled:opacity-40"
        >
          {committing ? "반영 중..." : `선택한 ${selectedIds.size}명 회원으로 등록`}
        </button>
      )}
    </main>
  );
}
