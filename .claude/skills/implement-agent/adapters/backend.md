# 백엔드(NestJS/Node.js) 어댑터

| 슬롯 | 값 |
|---|---|
| 검증모드 | tdd |
| 게이트 명령 | `npm test`  (또는 프로젝트에 vitest 설정 시 `npx vitest run`) |
| coder 규칙 | backend-coding-rule |
| 2단계 reviewer | backend-reviewer |
| build resolver | 없음 (타입 에러는 coder가 `npx tsc --noEmit`로 자체 해결) |
| 작업 디렉토리 | . |

## 스택 특이사항

- **검증모드 tdd**: 골격은 task마다 coder에게 먼저 실패 테스트(`*.spec.ts`)를 작성시키고,
  `npm test`로 RED를 확인한 뒤 구현 → GREEN을 확인한다. RED 단계에서 테스트가 통과해버리면
  (= 테스트가 기능을 검증하지 못함) 골격은 해당 task를 coder에게 반려한다.
- 테스트 러너는 프로젝트 설정을 따른다. Jest면 `npm test`, Vitest면 `npx vitest run`.
  단일 파일만 돌리려면 `npm test -- <파일경로>`를 쓴다.
- coder는 구현 전 `backend-coding-rule` 스킬을 preload하여 레이어/DI·비동기·에러·검증
  규칙을 사전에 적용한다 (backend-reviewer 차단 사유를 처음부터 회피).
- coder는 구현 전 `npx tsc --noEmit`로 타입 정합성을 자체 확인한다.
- e2e 테스트(`*.e2e-spec.ts`)는 task 미니사이클의 게이트에서 제외하고 PHASE 3 통합 점검으로 미룬다
  (단위 테스트만 task 게이트로 사용).
- **경량 모드(TASK ≤ 2)에서는 `2단계 reviewer`인 backend-reviewer를 호출하지 않고 main이
  직접 품질 점검한다.** TDD 게이트(`npm test`)와 `backend-coding-rule` preload는 경량 모드에서도
  그대로 유지되므로, 소규모 작업이라도 테스트·규칙 기반 품질선은 지켜진다.
