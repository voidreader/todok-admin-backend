---
name: backend-coding-rule
description: >
  Node.js/NestJS 백엔드에서 흔히 발생하는 실수를 방지한다 — 레이어/DI 경계, 비동기·
  floating promise, 에러 처리, DTO 검증, 타입 안전, 트랜잭션·N+1, 시크릿·인젝션, 로깅.
  coder가 구현 전 preload하여 backend-reviewer 차단 사유를 사전에 피한다.
---

이 규칙은 `backend-reviewer`의 검증 항목과 한 쌍이다. coder는 구현 전 이 규칙을 적용해
리뷰에서 막힐 코드를 처음부터 작성하지 않는다. 프로젝트 AGENTS.md/AGENTS.md 규칙이
이 문서와 충돌하면 프로젝트 규칙을 우선한다.

## 레이어 경계 (Controller / Service / Repository)
- Controller는 입출력만 — 요청 검증·라우팅·응답 변환. 비즈니스 로직은 Service로
- Service에서 DB 드라이버·쿼리 직접 호출 금지 — Repository(또는 ORM 리포지토리) 경유
- 도메인 규칙은 Service/도메인 계층에 — Repository는 영속성만 담당
- HTTP 관심사(상태코드·헤더)를 Service로 끌어들이지 말 것 — Service는 도메인 예외를 던지고 변환은 상위에서

## 의존성 주입 (DI)
- 의존성은 생성자 주입으로 — Service·Repository를 `new`로 직접 생성 금지
- 주입 대상은 모듈 `providers`에 등록 — 전역이 아니면 `exports`로 노출
- 인터페이스/토큰 기반 주입으로 테스트 시 mock 교체 가능하게 — 구체 클래스 강결합 회피
- 순환 의존은 설계 신호 — `forwardRef` 남용 전에 경계를 다시 나눌 것

## 모듈 경계
- 다른 모듈의 내부 provider를 직접 import 금지 — 모듈이 `exports`한 것만 사용
- 공유 기능은 별도 모듈로 추출 — 모듈 간 결합을 명시적 의존으로 표현
- 전역 모듈(`@Global`)은 정말 횡단 관심사(config·logger)에만

## 비동기 / Promise
- **floating promise 금지** — 모든 Promise는 `await`하거나 의도적으로 `void` 처리
- 독립 작업은 `Promise.all`로 병렬화 — 불필요한 순차 await로 지연 만들지 말 것
- 단, 하나라도 실패가 치명적이면 `Promise.allSettled`로 부분 실패 처리
- 루프 안 `await`는 직렬 실행 — 의도한 경우만. 대량이면 배치/동시성 제한
- `async` 함수는 항상 Promise 반환 — 콜백·`async`를 섞지 말 것
- 이벤트 핸들러·`setInterval` 콜백의 async 예외는 잡히지 않음 — 내부에서 try/catch

## 에러 처리
- 빈 `catch`로 예외 삼키지 말 것 — 처리하거나 로깅 후 재던지기
- 도메인 예외를 raw로 HTTP까지 전파 금지 — `HttpException`(또는 예외 필터)으로 매핑
- 예상 가능한 실패는 적절한 상태코드로 — 400 검증, 401/403 인증·인가, 404 없음, 409 충돌
- 외부 호출(HTTP·큐)은 타임아웃·재시도 정책을 명시 — 무한 대기 금지
- 에러 메시지에 내부 구현/스택을 클라이언트로 노출하지 말 것

## DTO·입력 검증
- 모든 요청 본문/쿼리/파라미터는 DTO + `class-validator`로 검증 — 검증 없는 `any` 수신 금지
- `ValidationPipe`에 `whitelist: true`·`forbidNonWhitelisted` 적용 — 미정의 필드 차단
- 응답도 직렬화 DTO/인터셉터로 — 엔티티를 그대로 반환해 민감 필드 노출 금지

## 타입 안전
- `any` 남용 금지 — 불가피하면 `unknown` 후 좁히기
- non-null `!` 단정 금지 — 옵셔널 체크/가드로 증명
- 런타임 경계(요청 body·외부 API 응답·env)는 타입을 신뢰하지 말고 검증 후 사용
- `process.env` 직접 접근 대신 검증된 ConfigService/스키마 경유

## DB / 트랜잭션 / 성능
- **N+1 회피** — 연관 데이터는 join/eager 또는 일괄 로딩으로
- 여러 쓰기가 원자적이어야 하면 트랜잭션으로 묶을 것 — 부분 커밋 방지
- 사용자 입력은 항상 파라미터 바인딩/쿼리빌더로 — 문자열 결합 쿼리 금지(injection)
- 목록 조회는 페이지네이션·상한 — 무한정 전체 로드 금지
- 인덱스 없는 컬럼으로 대량 필터/정렬하지 말 것

## 보안
- 시크릿·DB 자격증명·API key 하드코딩 금지 — 환경변수/ConfigService
- 보호 엔드포인트는 인증·인가 가드 필수 — 권한 체크 누락 금지
- 비밀번호·토큰·PII를 로그에 남기지 말 것
- 신뢰할 수 없는 입력으로 파일 경로·셸 명령·동적 쿼리 구성 금지

## 로깅·관용
- `console.log` 대신 구조화 로거(Nest `Logger`/pino 등) — 레벨 구분
- 매직 넘버·문자열은 상수/enum으로
- 네이밍·파일 구조는 기존 코드 컨벤션을 따를 것

## 테스트 (TDD 모드)
- 구현 전 실패 테스트(`*.spec.ts`)를 먼저 작성 — RED 확인 후 구현
- 동작을 단언할 것 — 구현 세부(내부 호출 횟수 등) 과도한 단언 회피
- happy path뿐 아니라 에러·경계 케이스도 — assertion 없는 항상 통과 테스트 금지
- 외부 의존성(DB·HTTP)은 적절히 mock/stub — 과잉도 누락도 피할 것
- e2e(`*.e2e-spec.ts`)는 task 게이트에서 분리 — 단위 테스트로 task를 검증
