"use client";

interface CallButtonProps {
  phone: string;
}

/**
 * 운영진 전용 전화 버튼. 회원 카드 전체가 <Link>(렌더링되면 <a> 태그)로
 * 감싸여 있어, 이 버튼을 <a href="tel:...">로 만들면 <a> 안에 <a>가 중첩되는
 * 유효하지 않은 HTML 구조가 되어 브라우저가 예측 불가능하게 동작할 수 있다.
 * 그래서 <button>으로 만들고, 클릭 시 stopPropagation으로 부모 Link의
 * 이동을 막은 뒤 location.href로 tel: 링크를 직접 연다.
 *
 * 현재는 이 버튼 자체를 부모(서버 컴포넌트)에서 isAdminSession() 기준으로만
 * 렌더링한다. 추후 permission_role >= manager로 교체할 때도 부모의 조건만
 * 바꾸면 되고, 이 컴포넌트는 그대로 재사용 가능하다.
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
