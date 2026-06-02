# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에 대한 가이드를 제공한다.

## 프로젝트 개요

`todok-admin-backend`는 **Todok**(익명 메시지 서비스, `AnonymousMessageWeb`) 의
**어드민 웹 애플리케이션을 위한 백엔드 서비스**다. NestJS로 구축한다.

- 어드민 운영자가 사용하는 관리 기능(신고 처리, 모더레이션, 사용자/프로필 관리,
  포인트/제재 등)을 위한 API를 제공하는 것이 목표다.
- 일반 사용자용 서비스 로직이 아니라 **운영자 전용 백오피스 API**에 집중한다.

### 연관 프로젝트

- `../AnonymousMessageWeb` — Todok 본 서비스 (Next.js + Supabase + Cloudflare Workers).
  Supabase에 `profiles`, `messages`, `moderation_events`, `reports`, `admin_role`,
  `point_transactions` 등의 테이블과 마이그레이션(`supabase/migrations/`)이 정의되어 있다.
  도메인 모델과 DB 스키마는 이 프로젝트를 기준으로 삼는다.

## 기술 스택

- **런타임/프레임워크**: Node.js + NestJS 11
- **언어**: TypeScript 5 (`strictNullChecks` 활성)
- **패키지 매니저**: pnpm (npm/yarn 사용 금지)
- **테스트**: Jest (`*.spec.ts`), E2E는 `test/` (`*.e2e-spec.ts`)
- **린트/포맷**: ESLint + Prettier

## 주요 명령어

```bash
pnpm install            # 의존성 설치
pnpm start:dev          # 개발 서버 (watch)
pnpm build              # 프로덕션 빌드 (dist/)
pnpm start:prod         # 빌드 산출물 실행
pnpm lint               # ESLint (--fix 포함)
pnpm format             # Prettier 포맷
pnpm test               # 단위 테스트
pnpm test:watch         # 단위 테스트 watch
pnpm test:cov           # 커버리지
pnpm test:e2e           # E2E 테스트
```

## 구조 및 컨벤션

- NestJS 표준 모듈 구조를 따른다: 도메인별 `Module` / `Controller` / `Service`.
- 비즈니스 로직은 `Service`에, 라우팅/검증은 `Controller`에 둔다.
- 외부 입력은 DTO + `class-validator`로 검증한다.
- 의존성은 생성자 주입(DI)으로 받는다. 레이어 경계(Controller→Service→Repository)를 지킨다.
- 코드 주석·커밋 메시지·문서는 한국어를 기본으로 한다 (기술 용어/고유명사 제외).

## 작업 시 주의사항

- 새 기능·동작 변경 구현 전에는 `backend-coding-rule` 스킬을 먼저 참고한다.
- 비밀값(Supabase 키, DB 자격증명 등)은 코드에 하드코딩하지 않고 환경 변수로 관리한다.
  `.env`는 git에 커밋하지 않는다 (`.env.example`만 추적).
- DB 스키마 변경이 필요한 경우, 실제 스키마는 `AnonymousMessageWeb`의 Supabase
  마이그레이션과 정합성을 맞춘다. 임의로 스키마를 가정하지 말고 실제 마이그레이션을 확인한다.
