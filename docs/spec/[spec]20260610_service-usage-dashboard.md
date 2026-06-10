# 서비스 이용 통계 대시보드 개발 명세서

> 요구 문서: `docs/plans/2026-06-10-service-usage-dashboard.md`
> 작성일: 2026년 6월 10일
> 마이그레이션 SQL: `docs/spec/migrations/[migration]20260610_user-activity-events.sql`

## 1. 개요

Todok 어드민 백엔드에 서비스 이용 통계 대시보드 API를 추가한다. 첫 버전은 오늘의 로그인 기반 DAU, 오늘의 메시지 발송 건수, 오늘의 답변 작성 건수, 최근 30일 추이, 최근 30일 유저별 TOP 10 집계를 제공한다.

일반 사용자 활동 이벤트 적재는 `AnonymousMessageWeb`의 Supabase 마이그레이션/RPC에서 처리한다. `todok-admin-backend`는 해당 이벤트와 기존 서비스 테이블을 읽어 운영자 전용 통계 API를 제공한다.

## 2. 요구사항

이 장은 구현자가 검증 가능한 기능 요구사항과 API 계약을 정의한다. 모든 통계 날짜 기준은 `Asia/Seoul` 일자를 사용한다.

### 2.1 기능 요구사항

- [FR-1] 어드민은 `GET /statistics/usage-dashboard`로 서비스 이용 통계 첫 화면 데이터를 조회한다.
  - 상세 동작: 엔드포인트는 `AdminGuard`로 보호한다.
  - 조건: 인증되지 않은 요청은 401, 어드민이 아닌 요청은 403으로 실패한다.

- [FR-2] API는 오늘 요약 지표를 반환한다.
  - 상세 동작: `summary`에 오늘 로그인 기반 DAU, 오늘 메시지 발송 건수, 오늘 답변 작성 건수를 포함한다.
  - 조건: 오늘은 `Asia/Seoul` 기준 00:00:00 이상, 다음 날 00:00:00 미만 범위다.

- [FR-3] API는 최근 30일 일자별 추이를 반환한다.
  - 상세 동작: `dailySeries`는 오늘을 포함한 최근 30개 날짜를 오름차순으로 반환한다.
  - 조건: 데이터가 없는 날짜도 0 값으로 포함한다.

- [FR-4] API는 최근 30일 유저별 받은 메시지 TOP 10을 반환한다.
  - 상세 동작: `messages.profile_id -> profiles.id` 기준으로 메시지 수를 집계한다.
  - 조건: 각 항목은 `profileId`, `nickname`, `slug`, `count`를 포함한다.

- [FR-5] API는 최근 30일 유저별 보낸 메시지 TOP 10을 반환한다.
  - 상세 동작: `user_activity_events.event_type = 'message_sent'` 기준으로 로그인 유저가 보낸 메시지 수를 집계한다.
  - 조건: `profiles.user_id`로 프로필을 찾을 수 있는 유저만 TOP 10에 포함한다.

- [FR-6] API는 최근 30일 유저별 답변 작성 TOP 10을 반환한다.
  - 상세 동작: `replies.profile_id -> profiles.id` 기준으로 답변 작성 수를 집계한다.
  - 조건: 답변 수정은 새 작성으로 세지 않고 `replies.created_at` 기준으로만 집계한다.

- [FR-7] 로그인 기반 DAU는 로그인 성공 이벤트를 기준으로 집계한다.
  - 상세 동작: `user_activity_events.event_type = 'login_success'`인 row에서 일자별 고유 `user_id` 수를 센다.
  - 조건: 같은 유저가 하루에 여러 번 로그인해도 DAU에는 1명으로 계산한다.

- [FR-8] 메시지 전체 발송 건수는 기존 `messages` 테이블 기준으로 집계한다.
  - 상세 동작: 전체 발송 건수는 익명 발송과 로그인 발송을 모두 포함한다.
  - 조건: 유저별 보낸 메시지 TOP 10은 로그인 유저의 `message_sent` 이벤트만 포함한다.

- [FR-9] 일반 사용자 활동 이벤트는 `AnonymousMessageWeb`의 Supabase 함수에서 적재한다.
  - 상세 동작: 로그인 성공 시 클라이언트가 `record_login_success()`를 호출하고, 로그인 유저의 메시지 전송 성공 시 `submit_public_message` RPC 내부에서 `record_message_sent(message_id)`를 호출한다.
  - 조건: `record_login_success()` 실패는 로그인 성공 사용자 경험을 깨뜨리지 않도록 클라이언트에서 잡아 무시한다. `record_message_sent(message_id)`는 클라이언트에 직접 공개하지 않고 `submit_public_message` 내부에서만 호출한다.

- [FR-10] 대시보드는 메시지 본문과 개별 발신자-수신자 관계를 반환하지 않는다.
  - 상세 동작: 통계 API 응답에는 집계 수치와 프로필 식별 정보만 포함한다.
  - 조건: `message.body`, `sender_hint`, `sender_fingerprint`, 특정 발신자와 수신자의 pair 정보는 응답에 포함하지 않는다.

### 2.2 API 계약

첫 버전은 대시보드 첫 화면에 필요한 단일 조회 API만 제공한다. 기간 커스터마이징은 이번 범위에 포함하지 않는다.

- **GET `/statistics/usage-dashboard`** — 서비스 이용 통계 대시보드 조회
  - 인증/권한: `AdminGuard`
  - 요청: 없음
  - 응답(성공): 200

```json
{
  "timezone": "Asia/Seoul",
  "today": "2026-06-10",
  "generatedAt": "2026-06-10T09:15:00.000Z",
  "summary": {
    "dau": 1284,
    "sentMessages": 4921,
    "repliesWritten": 1106
  },
  "dailySeries": [
    {
      "date": "2026-05-12",
      "dau": 910,
      "sentMessages": 3021,
      "repliesWritten": 710
    }
  ],
  "topReceivedMessages": [
    {
      "profileId": "11111111-1111-1111-1111-111111111111",
      "nickname": "토독",
      "slug": "todok",
      "count": 120
    }
  ],
  "topSentMessages": [
    {
      "profileId": "22222222-2222-2222-2222-222222222222",
      "nickname": "메신저",
      "slug": "messenger",
      "count": 84
    }
  ],
  "topReplies": [
    {
      "profileId": "33333333-3333-3333-3333-333333333333",
      "nickname": "답장왕",
      "slug": "reply-master",
      "count": 72
    }
  ]
}
```

  - 응답(실패):
    - 401: Bearer 토큰 없음 또는 JWT 검증 실패
    - 403: 인증 사용자가 어드민이 아님
  - 멱등성/트랜잭션: 읽기 전용 API이므로 멱등적이다. DB 쓰기 트랜잭션은 없다.

### 2.3 데이터 요구사항

통계 API는 기존 테이블과 신규 이벤트 테이블을 함께 사용한다. 백엔드 TypeORM `synchronize`와 `migrationsRun`은 계속 비활성으로 유지한다.

- 기존 테이블 매핑
  - `profiles`: 유저 표시 정보와 프로필 식별자 조회
  - `messages`: 전체 메시지 발송 건수와 받은 메시지 집계
  - `replies`: 답변 작성 건수와 답변 작성 TOP 10 집계

- 신규 테이블
  - `public.user_activity_events`
    - `id uuid primary key`
    - `user_id uuid not null references auth.users(id) on delete cascade`
    - `event_type text not null`
    - `ref_type text null`
    - `ref_id uuid null`
    - `event_date date not null`
    - `occurred_at timestamptz not null default now()`
    - `metadata jsonb not null default '{}'::jsonb`
    - `created_at timestamptz not null default now()`

- 제약과 인덱스
  - `event_type`은 `login_success`, `message_sent`만 허용한다.
  - `login_success` 이벤트는 `(user_id, event_type, event_date)` 단위로 중복 적재하지 않는다.
  - `message_sent` 이벤트는 `(user_id, event_type, ref_type, ref_id)` 단위로 중복 적재하지 않는다.
  - 일자별 집계를 위해 `(event_type, event_date)` 인덱스를 둔다.
  - 유저별 집계를 위해 `(event_type, user_id, occurred_at desc)` 인덱스를 둔다.

- 마이그레이션 필요 여부: 필요. 자세한 SQL은 5장을 따른다.

## 3. 영향 범위

이 장은 구현 시 수정하거나 생성할 파일을 명시한다. `AnonymousMessageWeb` 변경은 이 저장소 밖 작업이므로 명세에 영향 범위로만 기록한다.

### 3.1 수정 대상 파일

| 파일 경로 | 수정 내용 | 사유 |
| --- | --- | --- |
| `src/app.module.ts` | `StatisticsModule` import 추가 | 통계 API 모듈을 애플리케이션에 연결한다. |
| `../AnonymousMessageWeb/supabase/migrations/` | `user_activity_events` 테이블과 기록 함수 마이그레이션 추가 | 로그인 기반 DAU와 유저별 보낸 메시지 수를 정확히 적재한다. |
| `../AnonymousMessageWeb/src/features/account-protection/accountProtectionService.ts` | 이메일/비밀번호 로그인 성공 후 로그인 이벤트 기록 호출 | 로그인 기반 DAU 이벤트를 적재한다. |
| `../AnonymousMessageWeb/src/features/quick-start/quickStartProfile.ts` | `signInAnonymously()` 성공 후 로그인 이벤트 기록 호출 | 익명 빠른 시작 계정도 로그인 기반 DAU에 포함한다. 기존 세션 확인만 성공한 경우에는 새 로그인 이벤트를 남기지 않는다. |
| `../AnonymousMessageWeb/supabase/migrations/`의 `submit_public_message` RPC | 로그인 유저 메시지 전송 성공 시 `message_sent` 이벤트 기록 | 유저별 보낸 메시지 TOP 10을 집계한다. 클라이언트 직접 호출로 인한 이벤트 위조를 막는다. |

### 3.2 신규 생성 파일

| 파일 경로 | 역할 |
| --- | --- |
| `src/statistics/statistics.module.ts` | 통계 도메인 모듈 |
| `src/statistics/statistics.controller.ts` | `GET /statistics/usage-dashboard` 엔드포인트 |
| `src/statistics/statistics.service.ts` | 날짜 범위 구성과 응답 조립 |
| `src/statistics/repositories/statistics.repository.ts` | TypeORM/SQL 기반 집계 조회 |
| `src/statistics/dto/usage-dashboard-response.dto.ts` | 대시보드 응답 타입 |
| `src/statistics/entities/profile.entity.ts` | `profiles` 부분 매핑 엔티티 |
| `src/statistics/entities/message.entity.ts` | `messages` 부분 매핑 엔티티 |
| `src/statistics/entities/reply.entity.ts` | `replies` 부분 매핑 엔티티 |
| `src/statistics/entities/user-activity-event.entity.ts` | `user_activity_events` 매핑 엔티티 |
| `src/statistics/statistics.service.spec.ts` | 서비스 단위 테스트 |
| `src/statistics/statistics.controller.spec.ts` | 컨트롤러 단위 테스트 |
| `src/statistics/repositories/statistics.repository.spec.ts` | 집계 쿼리 경계 테스트 |
| `test/statistics.e2e-spec.ts` | 보호 API e2e 테스트 |
| `docs/spec/migrations/[migration]20260610_user-activity-events.sql` | 신규 이벤트 테이블과 기록 함수 SQL |

### 3.3 관련 모듈/시스템

- `AuthModule`: `AdminGuard`를 통계 API 보호에 사용한다.
- `DatabaseModule`: 기존 TypeORM 연결을 사용하며 스키마 자동 변경 설정은 유지한다.
- `AnonymousMessageWeb`: 로그인 성공과 메시지 전송 성공 이벤트를 Supabase 함수로 기록한다.
- Supabase Postgres: 신규 `user_activity_events` 테이블과 기록 함수가 필요하다.

## 4. 테스트 명세 (TDD)

backend 구현은 TDD 모드다. 아래 케이스는 coder가 작성할 RED 테스트의 입력이 된다. 각 FR은 최소 1개의 테스트 케이스와 매핑한다.

### 4.1 단위 테스트 (`*.spec.ts` — task 게이트)

다음 단위 테스트는 어드민 백엔드의 통계 API와 집계 로직을 검증한다.

| 테스트 ID | 대상 | 시나리오 | 입력 | 기대 결과 | 매핑 FR |
| --- | --- | --- | --- | --- | --- |
| UT-1 | `StatisticsController.getUsageDashboard` | 컨트롤러가 서비스 결과를 그대로 반환한다. | mock 서비스 응답 | 응답 객체가 서비스 반환값과 같다. | FR-1 |
| UT-2 | `StatisticsController.getUsageDashboard` | 엔드포인트에 `AdminGuard`가 적용된다. | 메타데이터 조회 | `UseGuards(AdminGuard)` 메타데이터가 존재한다. | FR-1 |
| UT-3 | `StatisticsService.getUsageDashboard` | 오늘 요약과 TOP 10, 30일 시계열을 조립한다. | repository mock 결과 | `summary`, `dailySeries`, `topReceivedMessages`, `topSentMessages`, `topReplies`가 응답에 포함된다. | FR-2, FR-3, FR-4, FR-5, FR-6 |
| UT-4 | `StatisticsService.getUsageDashboard` | 데이터가 없는 날짜를 0으로 채운다. | 일부 날짜만 있는 daily aggregate | 최근 30일 전체 날짜가 오름차순으로 반환되고 누락 날짜 값은 0이다. | FR-3 |
| UT-5 | `StatisticsService.getUsageDashboard` | KST 기준 오늘과 최근 30일 범위를 사용한다. | clock mock: `2026-06-10T15:30:00.000Z` | `today`는 UTC 날짜 `2026-06-10`이 아니라 KST 날짜 `2026-06-11`로 계산된다. 날짜 경계가 KST 00:00 기준이다. | FR-2, FR-3 |
| UT-6 | `StatisticsRepository.getDailySeries` | DAU는 같은 날짜 같은 유저의 중복 로그인 이벤트를 1명으로 센다. | login event fixture | 해당 날짜 `dau`가 distinct `user_id` 수와 같다. | FR-7 |
| UT-7 | `StatisticsRepository.getDailySeries` | 전체 메시지 발송 건수는 `messages` row 수를 센다. | messages fixture | 익명/로그인 여부와 무관하게 해당 날짜 메시지 수가 `sentMessages`로 반환된다. | FR-8 |
| UT-8 | `StatisticsRepository.getTopSentMessages` | 보낸 메시지 TOP 10은 `message_sent` 이벤트만 센다. | mixed event fixture | `login_success` 이벤트는 제외되고 count 내림차순으로 최대 10개만 반환된다. | FR-5 |
| UT-9 | `StatisticsRepository.getTopSentMessages` | 프로필이 없는 유저의 보낸 메시지 이벤트는 제외된다. | profile join 누락 fixture | 응답에 해당 유저가 포함되지 않는다. | FR-5 |
| UT-10 | `StatisticsRepository.getTopReceivedMessages` | 받은 메시지 TOP 10은 메시지 수를 프로필별로 집계한다. | messages/profile fixture | count 내림차순으로 최대 10개를 반환한다. | FR-4 |
| UT-11 | `StatisticsRepository.getTopReplies` | 답변 TOP 10은 `replies.created_at` 기준으로 집계한다. | replies/profile fixture | 수정일이 아닌 작성일 기준 count를 반환한다. | FR-6 |
| UT-12 | `UsageDashboardResponseDto` 또는 응답 mapper | 응답에 메시지 본문과 sender 정보를 포함하지 않는다. | aggregate row fixture | `body`, `senderHint`, `senderFingerprint`, `messageId`가 응답에 없다. | FR-10 |

### 4.2 e2e 테스트 (`*.e2e-spec.ts` — PHASE 3로 분리)

다음 e2e 테스트는 통계 API의 인증 경계와 응답 형태를 검증한다.

| 테스트 ID | 엔드포인트 | 시나리오 | 기대 상태코드/응답 | 매핑 FR |
| --- | --- | --- | --- | --- |
| E2E-1 | `GET /statistics/usage-dashboard` | 토큰이 없는 요청 | 401 | FR-1 |
| E2E-2 | `GET /statistics/usage-dashboard` | 어드민 Guard를 통과한 요청 | 200, `summary`와 `dailySeries` 포함 | FR-1, FR-2, FR-3 |
| E2E-3 | `GET /statistics/usage-dashboard` | mock 통계 데이터 조회 | 응답에 TOP 10 배열 3종 포함, 메시지 본문/발신자 fingerprint 없음 | FR-4, FR-5, FR-6, FR-10 |

### 4.3 원본 서비스 이벤트 적재 테스트

원본 서비스 변경은 `AnonymousMessageWeb`에서 별도 테스트로 검증한다. 이 저장소의 구현자는 해당 테스트가 필요한 사실을 명세에 따라 추적한다.

| 테스트 ID | 대상 | 시나리오 | 기대 결과 | 매핑 FR |
| --- | --- | --- | --- | --- |
| WEB-UT-1 | `signInWithEmailPassword` | 이메일/비밀번호 로그인 성공 | `record_login_success` 호출 | FR-7, FR-9 |
| WEB-UT-2 | `signInWithEmailPassword` | 로그인 실패 | `record_login_success` 미호출 | FR-7, FR-9 |
| WEB-UT-3 | `signInAnonymously` | 빠른 시작 익명 로그인 성공 | `record_login_success` 호출 | FR-7, FR-9 |
| WEB-UT-4 | `submit_public_message` RPC | 로그인 유저의 메시지 전송 성공 | RPC 내부에서 `record_message_sent(message_id)` 호출 | FR-5, FR-9 |
| WEB-UT-5 | `submit_public_message` RPC | 익명 방문자의 메시지 전송 성공 | 전체 메시지는 `messages`에 저장되지만 유저별 보낸 메시지 이벤트는 기록하지 않는다. | FR-5, FR-8, FR-9 |

## 5. 마이그레이션

spec-writer는 SQL 파일을 작성만 하고 실행 또는 적용하지 않는다. 적용은 구현·배포 단계에서 사람이 `AnonymousMessageWeb`의 Supabase 마이그레이션으로 옮겨 검토한 뒤 수행한다.

- SQL 파일 경로: `docs/spec/migrations/[migration]20260610_user-activity-events.sql`
- 적용 대상: `../AnonymousMessageWeb/supabase/migrations/`
- 마이그레이션 성격: 신규 테이블과 신규 함수 추가
- 파괴적 변경: 없음

## 6. 기술 참고사항

이 장은 구현자가 기존 패턴을 따라 안전하게 구현하기 위한 참고사항을 정리한다.

### 6.1 기존 패턴 참조

다음 파일은 구현 시 참고할 기존 패턴이다.

- `src/me/me.controller.ts`: `@UseGuards(AdminGuard)` 보호 컨트롤러 패턴을 참고한다.
- `src/auth/auth.module.ts`: 모듈 import/provider/export 구성 패턴을 참고한다.
- `src/database/database.module.ts`: TypeORM 연결과 스키마 자동 변경 금지 설정을 유지한다.
- `test/me.e2e-spec.ts`: Passport 전략과 Guard를 조립하는 e2e 테스트 패턴을 참고한다.
- `../AnonymousMessageWeb/src/features/account-protection/accountProtectionService.ts`: 이메일/비밀번호 로그인 성공 흐름을 참고한다.
- `../AnonymousMessageWeb/src/features/public-message/publicMessageService.ts`: 공개 메시지 전송 성공 응답의 `messageId` 처리 흐름을 참고한다.
- `../AnonymousMessageWeb/supabase/migrations/20260524_upgrade_moderation_pipeline.sql`: `submit_public_message` 현재 함수 본문과 권한 부여 패턴을 참고한다.

### 6.2 주의사항

다음 주의사항은 구현 중 반드시 유지한다.

- 통계 API는 반드시 `AdminGuard`로 보호한다.
- 통계 API 응답에는 메시지 본문, `sender_hint`, `sender_fingerprint`, 개별 발신자-수신자 pair를 포함하지 않는다.
- 집계 쿼리는 사용자 입력 문자열을 직접 이어 붙이지 않고 TypeORM QueryBuilder 또는 파라미터 바인딩 SQL을 사용한다.
- 대량 테이블 전체 scan을 줄이기 위해 모든 집계는 최근 30일 범위 조건을 먼저 적용한다.
- TypeORM `synchronize`와 `migrationsRun`은 계속 `false`다.
- 신규 이벤트 테이블은 백엔드 엔티티로 매핑만 하고 백엔드에서 스키마를 생성하지 않는다.
- 원본 서비스에 Supabase 마이그레이션을 추가할 때는 기존 RPC 시그니처를 깨지 않는다.

### 6.3 엣지 케이스

다음 엣지 케이스를 구현과 테스트에서 확인한다.

- 이벤트 적재 전 과거 날짜는 DAU와 유저별 보낸 메시지 수가 0 또는 부분 데이터로 표시된다.
- `profiles` row가 없는 유저 이벤트는 유저별 TOP 10에서 제외한다.
- 같은 유저가 하루에 여러 번 로그인해도 DAU는 1로 계산한다.
- 같은 메시지에 대해 `message_sent` 이벤트가 중복 호출되어도 중복 집계하지 않는다.
- 답변 수정은 `replies.updated_at`만 바뀌므로 답변 작성 건수에 새로 더하지 않는다.

### 6.4 구현 힌트

다음 힌트는 구현 방향을 좁히기 위한 참고사항이다.

- 진입점: `StatisticsController.getUsageDashboard()`
- 데이터 흐름: `StatisticsController -> StatisticsService -> StatisticsRepository -> TypeORM/DataSource -> Supabase Postgres`
- 날짜 정책: `Asia/Seoul` 기준 오늘과 최근 30일을 계산한 뒤, DB 조회에는 UTC instant 범위를 전달한다.
- 응답 조립: repository는 집계 row를 반환하고 service가 30일 날짜 배열과 0 채움을 담당한다.
- 원본 서비스 로그인 이벤트: 이메일/비밀번호 로그인과 익명 로그인 성공 후 `record_login_success()`를 호출한다. OAuth 로그인은 redirect 이후 세션 확정 지점에서 호출한다. 호출 실패는 로그인 성공 흐름을 깨뜨리지 않도록 잡아 무시한다.
- 원본 서비스 메시지 이벤트: `submit_public_message` RPC 내부에서 `auth.uid()`가 있을 때 `record_message_sent(v_msg_id)`를 호출한다. 클라이언트에서 `record_message_sent`를 직접 호출하지 않는다.

## 7. 기획 확인 사항

이 명세서는 기획 단계와 명세 작성 중 확인한 결정을 반영한다.

- [Q-1] DAU 기준은 무엇인가? → 로그인 성공 이벤트 기준으로 확정했다.
- [Q-2] 대시보드 첫 화면 구성은 무엇인가? → A안, 핵심 지표 요약형으로 확정했다.
- [Q-3] 유저별 메시지 수는 받은 메시지와 보낸 메시지 중 무엇을 포함하는가? → 둘 다 포함한다.
- [Q-4] 유저 식별 방식은 무엇인가? → 프로필 닉네임과 슬러그를 사용한다.
- [Q-5] 활동 이벤트 적재 위치는 어디인가? → `AnonymousMessageWeb`의 Supabase 마이그레이션/RPC에서 적재하고, 어드민 백엔드는 읽기 전용으로 집계한다.

### 7.1 이벤트 적재 위치 결정

활동 이벤트 적재 위치는 다음 비교를 바탕으로 결정했다.

| 옵션 | 장점 | 단점 | 결정 |
| --- | --- | --- | --- |
| A. `AnonymousMessageWeb`의 Supabase 마이그레이션/RPC에 이벤트 적재 추가 | 기존 사용자 인증 흐름과 메시지 RPC 가까이에 붙일 수 있고 어드민 백엔드 경계가 유지된다. | 원본 서비스 변경이 함께 필요하다. | 채택 |
| B. `todok-admin-backend`에 일반 사용자 이벤트 기록 API 추가 | 통계 기능이 한 프로젝트에 모인다. | 운영자 전용 백엔드가 일반 사용자 트래픽을 받게 되어 경계가 흐려진다. | 미채택 |
| C. 기존 테이블과 Supabase Auth `last_sign_in_at`만 사용 | DB 변경이 적다. | 과거 일별 DAU와 유저별 보낸 메시지 수를 정확히 만들 수 없다. | 미채택 |
