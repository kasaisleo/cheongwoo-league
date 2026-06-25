"use client";

interface CallButtonProps {
  phone: string;
}

/**
 * 전화 버튼. 일반 회원/운영진 모두에게 노출된다(전화하기 자체는 누구나 가능).
 * 다만 phone 텍스트 자체를 화면에 노출할지는 호출하는 쪽(부모)에서 운영진
 * 여부로 따로 결정한다 — 이 버튼은 phone 값만 받아서 tel: 링크로 연결한다.
 *
 * 회원 카드 전체가 <Link>(렌더링되면 <a> 태그)로 감싸여 있어, 이 버튼을
 * <a href="tel:...">로 만들면 <a> 안에 <a>가 중첩되는 유효하지 않은 HTML
 * 구조가 되어 브라우저가 예측 불가능하게 동작할 수 있다. 그래서 <button>으로
 * 만들고, 클릭 시 stopPropagation으로 부모 Link의 이동을 막은 뒤
 * location.href로 tel: 링크를 직접 연다.
 */
export function CallButton({ phone }: CallButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = `tel:${phone}`;
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-court-400 text-court-400"
      aria-label={`${phone}로 전화하기`}
    >
      <span aria-hidden="true">📞</span>
    </button>
  );
}
