# DB 연동 및 어드민 인증 설계

- 날짜: 2026-06-02
- 상태: 승인됨
- 대상: `todok-admin-backend` (Todok 어드민 백오피스 백엔드, NestJS 11)

## 배경

Todok 본 서비스(`AnonymousMessageWeb`, Next.js + Supabase)는 스키마를
`supabase/migrations/`에서 정본으로 관리하고, 어드민 인증을 Supabase Auth +
`admin_users` 테이블 + `is_admin()` RPC로 처리한다. 본 백엔드는 그 운영자 전용
백오피스 API를 제공하며, 다음 두 가지 기반 설계를 확정한다.

추가 제약:
- 이 프로젝트는 **NestJS 포트폴리오 용도**를 겸한다 → 표준 NestJS 패턴(DI, Module,
  Guard, Passport, 커스텀 데코레이터)을 명시적으로 구현해 드러낸다.
- **허가 없이 운영 DB 스키마를 수정하지 못하도록** 안전장치를 둔다.

---

## 결정 1: DB 연동 — TypeORM (읽기 위주 + 쓰기 보호)

### 연결
- TypeORM `DataSource`를 NestJS `TypeOrmModule`로 구성하여 **Supabase Postgres에
  직접 연결**한다. 접속 정보는 환경 변수로 주입한다.
- Supabase 직접 연결의 Postgres role은 **RLS를 우회**하므로, 기존 웹이
  `service role key`로 얻던 권한을 DB 레벨에서 동일하게 확보한다. 별도의 Supabase
  service role 클라이언트는 두지 않는다.
- 커넥션 풀링이 필요한 배포 환경에서는 Supabase pooler(transaction mode, 6543)
  사용을 검토한다. 로컬/직결은 5432.

### 스키마 소유권 보호 ("허가 없이 DB 수정 금지")
- `synchronize: false`를 **강제**한다 — 엔티티 정의 변경이 절대 DDL로 자동
  반영되지 않는다.
- `migrationsRun: false` — 앱 부팅 시 마이그레이션을 자동 실행하지 않는다.
- 엔티티는 **기존 Supabase 테이블을 매핑만** 한다. 대상 예시: `profiles`,
  `messages`, `reports`, `moderation_events`, `admin_users`, `point_transactions`.
  스키마 정본은 `AnonymousMessageWeb/supabase/migrations/`에 있다.
- 스키마 변경이 필요하면 TypeORM 마이그레이션이 아니라 **Supabase 마이그레이션으로,
  사용자 승인을 받은 뒤** 진행한다. 백엔드는 스키마를 소유하지 않는다.

### 산출물
- `DatabaseModule` (TypeOrmModule 설정, DataSource)
- 도메인별 엔티티 클래스 (기존 테이블 매핑)
- 도메인별 Repository는 NestJS DI로 주입

---

## 결정 2: 어드민 인증 — Supabase JWT(비대칭/JWKS) 검증 + Passport Guard

### 흐름
1. 어드민 웹이 Supabase Auth로 로그인하여 access token(JWT)을 획득한다.
2. 백엔드 호출 시 `Authorization: Bearer <jwt>`로 전달한다.
3. NestJS **Passport JWT strategy**가 토큰을 검증한다.
   - Supabase는 **비대칭 키(JWKS)** 를 사용한다.
   - JWKS 엔드포인트 `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`에서 공개키를
     받아 `kid` 매칭으로 서명을 검증한다 (jose `createRemoteJWKSet` 또는
     `jwks-rsa`). 알고리즘은 JWKS가 제공하는 키(RS256/ES256)를 따른다.
   - `issuer = ${SUPABASE_URL}/auth/v1`, `audience = authenticated` 검증.
   - JWKS는 캐시하고 키 롤오버에 대응한다.
4. 검증된 `sub`(user_id)로 **인가 판정**한다 — 기존 `is_admin()`과 동일 로직 재현:
   `app_metadata.role == 'admin'` **또는** `admin_users` 테이블에 해당 user_id 존재.
   테이블 조회는 TypeORM `admin_users` 엔티티로 수행한다.
5. 컨트롤러는 `@UseGuards(AdminGuard)`로 보호하고, `@CurrentUser()` 커스텀
   데코레이터로 인증 주체를 주입받는다.

### 산출물
- `AuthModule`
  - `SupabaseJwtStrategy` (Passport JWT, JWKS 기반 검증)
  - `AdminGuard` (인증 + admin 인가)
  - `@CurrentUser()` 파라미터 데코레이터
- HS256(legacy secret)이 아니라 **JWKS 기반**이므로, 키 롤오버 시 코드 변경 없이
  대응 가능하도록 remote JWKS set을 사용한다.

---

## 환경 변수

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres 접속 문자열 (TypeORM) |
| `SUPABASE_URL` | JWKS/issuer 유도용 (`${SUPABASE_URL}/auth/v1/...`) |

`.env`는 커밋하지 않으며 `.env.example`만 추적한다.

---

## 영향 / 후속

- CLAUDE.md의 "DB 연동 방식"·"어드민 인증 방식"을 본 결정으로 갱신한다.
- 본 설계는 기반(infra) 결정이며, 개별 어드민 기능(신고 처리, 모더레이션 등) API는
  별도 명세로 다룬다.
- 다음 단계: 구현 계획(writing-plans) 작성.
