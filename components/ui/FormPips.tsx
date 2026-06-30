/**
 * FormPips — 최근 경기 폼을 W/L 박스 시퀀스로 표시.
 *
 * 사용 위치 (Step 15-4 이후 적용 예정):
 *   - 랭킹 목록 각 행 (최근 5경기)
 *   - 회원 상세 프로필 헤더
 *   - 홈 랭킹 하이라이트 섹션
 *
 * form: ("W" | "L")[] — 최신순, 최대 5개 기준
 *   "W" → 초록 박스 (win 컬러)
 *   "L" → 빨강 박스 (loss 컬러)
 *
 * limit: 표시할 최대 개수 (기본 5)
 *
 * 사용 예시:
 *   <FormPips form={["W", "W", "L", "W", "L"]} />
 *   → [W][W][L][W][L]
 */

type FormResult = "W" | "L";

interface FormPipsProps {
  form: FormResult[];
  limit?: number;
  className?: string;
}

export function FormPips({ form, limit = 5, className = "" }: FormPipsProps) {
  const displayed = form.slice(0, limit);

  if (displayed.length === 0) {
    return (
      <span className={`text-xs text-line-500 ${className}`}>—</span>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {displayed.map((result, index) => (
        <span
          key={index}
          title={result === "W" ? "Win" : "Loss"}
          className={`flex h-5 w-5 items-center justify-center rounded-sm font-score text-[10px] font-bold ${
            result === "W"
              ? "bg-win/20 text-win"
              : "bg-loss/20 text-loss"
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  );
}
