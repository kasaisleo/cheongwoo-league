/**
 * lib/event-pairing/engine.ts — 자동 대진 엔진의 서버 제품 경계.
 *
 * 제품 코드(향후 Preview API 포함)는 반드시 이 파일에서 import 한다.
 * core.ts 를 직접 import 해도 되는 곳은 engine.ts 와 승인된 테스트 파일뿐이다.
 *
 * `server-only` 는 Next 빌드에서만 해석되는 alias 다 — client component 가 이
 * 모듈을 import 하면 빌드가 실패한다. 그래서 순수 계산은 core.ts 에 두고
 * (node --test 가 직접 import 할 수 있도록) 서버 경계만 여기서 만든다.
 *
 * 공개 surface 는 최소로 유지한다 — export * 를 쓰지 않는다.
 */
import "server-only";

export { runEventPairing } from "./core.ts";

export type {
  PairingPreviewResult,
  PairingPreviewSuccess,
  PairingPreviewFailure,
  PairingGameDecision,
  PairingSummary,
  PairingWarning,
  PairingReason,
  PairingWarningCode,
  RunEventPairingArgs,
} from "./types.ts";
