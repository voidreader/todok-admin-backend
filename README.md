# todok-admin-backend

Todok(익명 메시지 서비스, `AnonymousMessageWeb`)의 어드민 웹 애플리케이션을 위한
백엔드 서비스다. 운영자 전용 백오피스 API(신고 처리, 모더레이션, 사용자/프로필 관리,
포인트/제재 등)를 제공한다.

## 기술 스택

- Node.js + NestJS 11
- TypeScript 5
- TypeORM (Supabase Postgres 직접 연결)
- Passport JWT + Supabase 비대칭 JWT(JWKS) 검증
- pnpm
- Jest

## 프로젝트 설정

의존성을 설치한다.

```bash
pnpm install
```

## 환경 변수 설정

이 서비스는 Supabase Postgres 연결과 어드민 인증에 환경 변수를 사용한다. 실제 비밀값이
필요하므로 `.env` 파일은 저장소에 포함하지 않으며, `.env.example`을 복사해 직접 채운다.

1. 예시 파일을 복사한다.

   ```bash
   cp .env.example .env
   ```

2. `.env`의 값을 실제 Supabase 프로젝트 값으로 채운다.

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | 필수 | Supabase Postgres 접속 문자열. Supabase 대시보드의 **Project Settings → Database → Connection string**에서 확인한다. |
| `SUPABASE_URL` | 필수 | Supabase 프로젝트 URL. **Project Settings → API → Project URL**에서 확인한다. JWKS 엔드포인트와 토큰 issuer를 유도하는 데 사용한다. |
| `PORT` | 선택 | HTTP 포트. 기본값은 `3000`이다. |

환경 변수는 애플리케이션 부팅 시점에 검증한다. `DATABASE_URL`이 없거나 `SUPABASE_URL`이
URL 형식이 아니면 부팅이 중단된다.

> **참고:** 어드민 인증은 Supabase의 **비대칭 키(JWKS)** 로 JWT 서명을 검증한다. 별도의
> JWT 시크릿 환경 변수는 필요하지 않으며, `SUPABASE_URL`로부터 JWKS 엔드포인트를 유도한다.

## 실행

```bash
# 개발 모드 (watch)
pnpm start:dev

# 프로덕션 빌드 후 실행
pnpm build
pnpm start:prod
```

애플리케이션을 실제로 실행하려면 위의 환경 변수가 유효한 값으로 설정되어 있어야 한다.

## 테스트

```bash
# 단위 테스트
pnpm test

# e2e 테스트
pnpm test:e2e

# 커버리지
pnpm test:cov

# 린트
pnpm lint
```

단위 테스트와 e2e 테스트는 `AppModule` 전체를 부팅하지 않으므로 실제 데이터베이스 연결
없이도 실행된다.

## 문서

기반 설계와 구현 계획은 다음 문서를 참고한다.

- 설계: `docs/superpowers/specs/2026-06-02-db-and-auth-design.md`
- 구현 계획: `docs/superpowers/plans/2026-06-02-db-auth-foundation.md`
- 프로젝트 가이드: `CLAUDE.md`
