# DB 연동 및 어드민 인증 기반 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TypeORM 기반 Supabase Postgres 연동과 Supabase 비대칭 JWT(JWKS) 검증 + 어드민 인가 Guard를 갖춘 NestJS 기반 인프라를 구축한다.

**Architecture:** `ConfigModule`로 환경 변수를 검증하고, `DatabaseModule`이 TypeORM을 `synchronize:false`/`migrationsRun:false`로 안전하게 연결한다. `AuthModule`은 `passport-jwt` + `jwks-rsa`로 Supabase JWT를 JWKS 검증하고(`SupabaseJwtStrategy`), `AuthService.isAdmin`으로 인가를 판정하며(`AdminGuard`), `@CurrentUser()`로 인증 주체를 주입한다. 개별 어드민 기능 API는 본 계획 범위 밖이며 별도 명세로 다룬다.

**Tech Stack:** NestJS 11, TypeScript 5, TypeORM + pg, @nestjs/config, class-validator/class-transformer, @nestjs/passport + passport + passport-jwt, jwks-rsa, Jest.

**근거 설계:** `docs/superpowers/specs/2026-06-02-db-and-auth-design.md`

---

## 파일 구조

생성/수정할 파일과 책임:

| 파일 | 책임 |
| --- | --- |
| `src/config/env.validation.ts` | 환경 변수 스키마 정의 + `validateEnv` 검증 함수 |
| `src/config/env.validation.spec.ts` | 환경 변수 검증 단위 테스트 |
| `src/database/database.module.ts` | TypeORM 설정 모듈 + `typeOrmConfigFactory` (synchronize/migrationsRun 비활성) |
| `src/database/database.module.spec.ts` | 팩토리가 스키마 보호 옵션을 반환하는지 단위 테스트 |
| `src/auth/types/authenticated-user.ts` | `AuthenticatedUser` 인터페이스 |
| `src/auth/entities/admin-user.entity.ts` | `admin_users` 테이블 매핑 엔티티 |
| `src/auth/auth.service.ts` | `isAdmin` 인가 판정 로직 |
| `src/auth/auth.service.spec.ts` | 인가 로직 단위 테스트 |
| `src/auth/strategies/supabase-jwt.strategy.ts` | `passport-jwt` + JWKS 검증 전략 |
| `src/auth/strategies/supabase-jwt.strategy.spec.ts` | `validate` 매핑 단위 테스트 |
| `src/auth/guards/admin.guard.ts` | 인증 + 어드민 인가 Guard |
| `src/auth/guards/admin.guard.spec.ts` | Guard 인가 분기 단위 테스트 |
| `src/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` 파라미터 데코레이터 + `getCurrentUser` |
| `src/auth/decorators/current-user.decorator.spec.ts` | `getCurrentUser` 단위 테스트 |
| `src/auth/auth.module.ts` | Auth 관련 프로바이더 조립 |
| `src/me/me.controller.ts` | `@UseGuards(AdminGuard)` 보호 예시 엔드포인트 `GET /me` |
| `src/me/me.module.ts` | MeController 모듈 |
| `src/app.module.ts` | (수정) Config/Database/Auth/Me 모듈 조립 |
| `src/main.ts` | (수정) 전역 `ValidationPipe` 적용 |
| `.env.example` | 필요한 환경 변수 예시 (추적 대상) |

---

## Task 1: 의존성 설치

**Files:** `package.json` (수정)

- [ ] **Step 1: 런타임 의존성 설치**

```bash
pnpm add @nestjs/config @nestjs/typeorm typeorm pg class-validator class-transformer @nestjs/passport passport passport-jwt jwks-rsa
```

- [ ] **Step 2: 타입 의존성 설치**

```bash
pnpm add -D @types/passport-jwt
```

- [ ] **Step 3: 설치 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없이 종료 (exit 0). 기존 코드가 컴파일됨.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: DB 연동·인증 기반 의존성 추가"
```

---

## Task 2: 환경 변수 검증

**Files:**
- Create: `src/config/env.validation.ts`
- Test: `src/config/env.validation.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/config/env.validation.spec.ts`:

```typescript
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgres://user:pass@db.example.supabase.co:5432/postgres',
    SUPABASE_URL: 'https://example.supabase.co',
  };

  it('유효한 환경 변수를 통과시킨다', () => {
    const result = validateEnv(valid);
    expect(result.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(result.SUPABASE_URL).toBe(valid.SUPABASE_URL);
  });

  it('DATABASE_URL이 없으면 예외를 던진다', () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow();
  });

  it('SUPABASE_URL이 URL 형식이 아니면 예외를 던진다', () => {
    expect(() => validateEnv({ ...valid, SUPABASE_URL: 'not-a-url' })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/config/env.validation.spec.ts`
Expected: FAIL — `Cannot find module './env.validation'`

- [ ] **Step 3: 최소 구현 작성**

`src/config/env.validation.ts`:

```typescript
import { plainToInstance } from 'class-transformer';
import { IsString, IsUrl, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`환경 변수 검증 실패: ${errors.toString()}`);
  }

  return validated;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/config/env.validation.spec.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/config/env.validation.ts src/config/env.validation.spec.ts
git commit -m "feat: 환경 변수 검증 추가"
```

---

## Task 3: DatabaseModule (스키마 보호 옵션 포함)

**Files:**
- Create: `src/database/database.module.ts`
- Test: `src/database/database.module.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/database/database.module.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { typeOrmConfigFactory } from './database.module';

describe('typeOrmConfigFactory', () => {
  const config = {
    getOrThrow: (key: string) =>
      key === 'DATABASE_URL'
        ? 'postgres://user:pass@db.example.supabase.co:5432/postgres'
        : undefined,
  } as unknown as ConfigService;

  it('운영 DB 스키마를 보호한다 (synchronize/migrationsRun 비활성)', () => {
    const options = typeOrmConfigFactory(config);
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it('postgres 타입과 DATABASE_URL을 사용한다', () => {
    const options = typeOrmConfigFactory(config);
    expect(options.type).toBe('postgres');
    expect(options.url).toContain('postgres://');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/database/database.module.spec.ts`
Expected: FAIL — `Cannot find module './database.module'`

- [ ] **Step 3: 최소 구현 작성**

`src/database/database.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

export function typeOrmConfigFactory(
  config: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    // 운영 DB 스키마 보호: 허가 없이 스키마를 변경하지 않는다.
    synchronize: false,
    migrationsRun: false,
    ssl: { rejectUnauthorized: false },
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfigFactory,
    }),
  ],
})
export class DatabaseModule {}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/database/database.module.spec.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/database/database.module.ts src/database/database.module.spec.ts
git commit -m "feat: TypeORM DatabaseModule 추가 (스키마 보호 옵션)"
```

---

## Task 4: AuthenticatedUser 타입 + AdminUser 엔티티

**Files:**
- Create: `src/auth/types/authenticated-user.ts`
- Create: `src/auth/entities/admin-user.entity.ts`

> 이 태스크는 타입/엔티티 선언만 한다. 동작 테스트는 이후 태스크(AuthService 등)가 커버한다.

- [ ] **Step 1: AuthenticatedUser 타입 작성**

`src/auth/types/authenticated-user.ts`:

```typescript
export interface AppMetadata {
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  appMetadata: AppMetadata;
}
```

- [ ] **Step 2: AdminUser 엔티티 작성**

기존 스키마 `supabase/migrations/20260524_create_admin_role_table.sql`의 `public.admin_users` 컬럼을 매핑한다.

`src/auth/entities/admin-user.entity.ts`:

```typescript
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_users' })
export class AdminUser {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없이 종료 (exit 0)

- [ ] **Step 4: Commit**

```bash
git add src/auth/types/authenticated-user.ts src/auth/entities/admin-user.entity.ts
git commit -m "feat: AuthenticatedUser 타입 및 AdminUser 엔티티 추가"
```

---

## Task 5: AuthService.isAdmin 인가 로직

**Files:**
- Create: `src/auth/auth.service.ts`
- Test: `src/auth/auth.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/auth.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { AuthenticatedUser } from './types/authenticated-user';

describe('AuthService', () => {
  let service: AuthService;
  let findOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(AdminUser),
          useValue: { findOne } as Partial<Repository<AdminUser>>,
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  const baseUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    userId: '11111111-1111-1111-1111-111111111111',
    appMetadata: {},
    ...overrides,
  });

  it('app_metadata.role이 admin이면 테이블 조회 없이 true', async () => {
    const result = await service.isAdmin(baseUser({ appMetadata: { role: 'admin' } }));
    expect(result).toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('admin_users 테이블에 존재하면 true', async () => {
    findOne.mockResolvedValue({ userId: baseUser().userId } as AdminUser);
    const result = await service.isAdmin(baseUser());
    expect(result).toBe(true);
    expect(findOne).toHaveBeenCalledWith({ where: { userId: baseUser().userId } });
  });

  it('role도 아니고 테이블에도 없으면 false', async () => {
    findOne.mockResolvedValue(null);
    const result = await service.isAdmin(baseUser());
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/auth/auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: 최소 구현 작성**

`src/auth/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from './entities/admin-user.entity';
import { AuthenticatedUser } from './types/authenticated-user';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUsers: Repository<AdminUser>,
  ) {}

  // 기존 웹의 is_admin() 로직 재현:
  // app_metadata.role === 'admin' 또는 admin_users 테이블에 존재.
  async isAdmin(user: AuthenticatedUser): Promise<boolean> {
    if (user.appMetadata?.role === 'admin') {
      return true;
    }

    const found = await this.adminUsers.findOne({
      where: { userId: user.userId },
    });
    return found !== null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/auth/auth.service.spec.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat: AuthService.isAdmin 인가 로직 추가"
```

---

## Task 6: SupabaseJwtStrategy (JWKS 검증)

**Files:**
- Create: `src/auth/strategies/supabase-jwt.strategy.ts`
- Test: `src/auth/strategies/supabase-jwt.strategy.spec.ts`

> JWKS 서명 검증 자체는 `passport-jwt` + `jwks-rsa`가 처리하므로, 우리 코드의 책임인 `validate(payload)` 매핑만 단위 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/strategies/supabase-jwt.strategy.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { SupabaseJwtStrategy } from './supabase-jwt.strategy';

describe('SupabaseJwtStrategy', () => {
  const config = {
    getOrThrow: (key: string) =>
      key === 'SUPABASE_URL' ? 'https://example.supabase.co' : undefined,
  } as unknown as ConfigService;

  const strategy = new SupabaseJwtStrategy(config);

  it('payload를 AuthenticatedUser로 매핑한다', () => {
    const user = strategy.validate({
      sub: '22222222-2222-2222-2222-222222222222',
      email: 'admin@todok.test',
      app_metadata: { role: 'admin' },
    });

    expect(user.userId).toBe('22222222-2222-2222-2222-222222222222');
    expect(user.email).toBe('admin@todok.test');
    expect(user.appMetadata.role).toBe('admin');
  });

  it('app_metadata가 없으면 빈 객체로 매핑한다', () => {
    const user = strategy.validate({
      sub: '33333333-3333-3333-3333-333333333333',
    });

    expect(user.appMetadata).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/auth/strategies/supabase-jwt.strategy.spec.ts`
Expected: FAIL — `Cannot find module './supabase-jwt.strategy'`

- [ ] **Step 3: 최소 구현 작성**

`src/auth/strategies/supabase-jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../types/authenticated-user';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  app_metadata?: { role?: string } & Record<string, unknown>;
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase 비대칭 키(ES256/RS256) 모두 허용. 신뢰 근거는 JWKS의 키다.
      algorithms: ['ES256', 'RS256'],
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      appMetadata: payload.app_metadata ?? {},
    };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/auth/strategies/supabase-jwt.strategy.spec.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/auth/strategies/supabase-jwt.strategy.ts src/auth/strategies/supabase-jwt.strategy.spec.ts
git commit -m "feat: Supabase JWT(JWKS) 검증 전략 추가"
```

---

## Task 7: AdminGuard (인증 + 인가)

**Files:**
- Create: `src/auth/guards/admin.guard.ts`
- Test: `src/auth/guards/admin.guard.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/guards/admin.guard.spec.ts`:

```typescript
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user';

describe('AdminGuard', () => {
  const user: AuthenticatedUser = {
    userId: '44444444-4444-4444-4444-444444444444',
    appMetadata: {},
  };

  const makeContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const makeGuard = (isAdmin: boolean) => {
    const authService = { isAdmin: jest.fn().mockResolvedValue(isAdmin) } as unknown as AuthService;
    const guard = new AdminGuard(authService);
    // 부모(AuthGuard)의 인증 통과를 가정한다.
    const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);
    return { guard, authService };
  };

  afterEach(() => jest.restoreAllMocks());

  it('인증 통과 + 어드민이면 true', async () => {
    const { guard } = makeGuard(true);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('인증 통과 + 어드민 아니면 ForbiddenException', async () => {
    const { guard } = makeGuard(false);
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/auth/guards/admin.guard.spec.ts`
Expected: FAIL — `Cannot find module './admin.guard'`

- [ ] **Step 3: 최소 구현 작성**

`src/auth/guards/admin.guard.ts`:

```typescript
import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class AdminGuard extends AuthGuard('supabase-jwt') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) JWT 인증 (실패 시 passport가 UnauthorizedException)
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) {
      return false;
    }

    // 2) 어드민 인가
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const isAdmin = await this.authService.isAdmin(request.user);
    if (!isAdmin) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/auth/guards/admin.guard.spec.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/auth/guards/admin.guard.ts src/auth/guards/admin.guard.spec.ts
git commit -m "feat: AdminGuard 추가 (인증 + 어드민 인가)"
```

---

## Task 8: @CurrentUser 데코레이터

**Files:**
- Create: `src/auth/decorators/current-user.decorator.ts`
- Test: `src/auth/decorators/current-user.decorator.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/decorators/current-user.decorator.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

describe('getCurrentUser', () => {
  it('request.user를 반환한다', () => {
    const user: AuthenticatedUser = {
      userId: '55555555-5555-5555-5555-555555555555',
      appMetadata: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(getCurrentUser(undefined, context)).toBe(user);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm exec jest src/auth/decorators/current-user.decorator.spec.ts`
Expected: FAIL — `Cannot find module './current-user.decorator'`

- [ ] **Step 3: 최소 구현 작성**

`src/auth/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

export function getCurrentUser(
  _data: unknown,
  context: ExecutionContext,
): AuthenticatedUser {
  const request = context
    .switchToHttp()
    .getRequest<{ user: AuthenticatedUser }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(getCurrentUser);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec jest src/auth/decorators/current-user.decorator.spec.ts`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add src/auth/decorators/current-user.decorator.ts src/auth/decorators/current-user.decorator.spec.ts
git commit -m "feat: @CurrentUser 데코레이터 추가"
```

---

## Task 9: AuthModule 조립

**Files:**
- Create: `src/auth/auth.module.ts`

- [ ] **Step 1: AuthModule 작성**

`src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { AdminGuard } from './guards/admin.guard';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';

@Module({
  imports: [ConfigModule, PassportModule, TypeOrmModule.forFeature([AdminUser])],
  providers: [SupabaseJwtStrategy, AuthService, AdminGuard],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
```

- [ ] **Step 2: 컴파일 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없이 종료 (exit 0)

- [ ] **Step 3: Commit**

```bash
git add src/auth/auth.module.ts
git commit -m "feat: AuthModule 조립"
```

---

## Task 10: 보호 예시 엔드포인트 (GET /me) + e2e

**Files:**
- Create: `src/me/me.controller.ts`
- Create: `src/me/me.module.ts`
- Test: `test/me.e2e-spec.ts`

- [ ] **Step 1: MeController 작성**

`src/me/me.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('me')
export class MeController {
  @UseGuards(AdminGuard)
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.userId, email: user.email };
  }
}
```

- [ ] **Step 2: MeModule 작성**

`src/me/me.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
})
export class MeModule {}
```

- [ ] **Step 3: 실패하는 e2e 테스트 작성**

토큰 없는 요청은 401이어야 한다. (유효 토큰 경로는 JWKS 실서명이 필요하므로 단위 테스트로 커버하며, e2e는 인증 차단만 검증한다.)

`test/me.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MeController } from '../src/me/me.controller';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { AuthService } from '../src/auth/auth.service';
import { SupabaseJwtStrategy } from '../src/auth/strategies/supabase-jwt.strategy';

describe('Me (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [MeController],
      providers: [
        { provide: AuthService, useValue: { isAdmin: jest.fn() } },
        // 전략 생성자가 SUPABASE_URL을 요구하므로 ConfigService를 목으로 제공한다.
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'https://example.supabase.co' },
        },
        // 전략을 등록해야 passport가 토큰 없는 요청을 401로 차단한다.
        SupabaseJwtStrategy,
        AdminGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /me는 토큰이 없으면 401', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });
});
```

- [ ] **Step 4: e2e 테스트 실행**

Run: `pnpm test:e2e -- test/me.e2e-spec.ts`
Expected: PASS (1 passed) — 컨트롤러는 Step 1~2에서 이미 만들었으므로 곧바로 실행되며,
토큰 없는 요청이 passport 전략에 의해 401로 차단되는지를 검증한다. (이 e2e는 인증
차단 검증이 목적이라 명시적 red 단계는 두지 않는다.)

- [ ] **Step 5: Commit**

```bash
git add src/me/me.controller.ts src/me/me.module.ts test/me.e2e-spec.ts
git commit -m "feat: 보호 예시 엔드포인트 GET /me 추가"
```

---

## Task 11: 앱 조립 (AppModule/main.ts) + .env.example

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`
- Create: `.env.example`

- [ ] **Step 1: AppModule 수정**

`src/app.module.ts` 전체를 다음으로 교체:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    AuthModule,
    MeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: main.ts 수정**

`src/main.ts` 전체를 다음으로 교체:

```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

- [ ] **Step 3: .env.example 작성**

`.env.example`:

```bash
# Supabase Postgres 접속 문자열 (TypeORM)
DATABASE_URL=postgres://postgres:password@db.your-project.supabase.co:5432/postgres

# Supabase 프로젝트 URL (JWKS/issuer 유도용)
SUPABASE_URL=https://your-project.supabase.co

# (선택) HTTP 포트. 기본 3000
PORT=3000
```

- [ ] **Step 4: 기존 단위 테스트 회귀 확인**

Run: `pnpm test`
Expected: 모든 단위 스펙 PASS (env/database/auth.service/strategy/guard/decorator/app.controller).

- [ ] **Step 5: 빌드 확인**

Run: `pnpm build`
Expected: 에러 없이 `dist/` 생성 (exit 0).

- [ ] **Step 6: 린트 확인**

Run: `pnpm lint`
Expected: 에러 없이 종료 (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/app.module.ts src/main.ts .env.example
git commit -m "feat: AppModule/main 조립 및 .env.example 추가"
```

---

## 검증 요약

전체 완료 후:

```bash
pnpm test        # 단위 테스트 전부 통과
pnpm test:e2e    # GET /me 401 통과
pnpm build       # 빌드 성공
pnpm lint        # 린트 통과
```

## 범위 밖 (후속 명세)

- 개별 어드민 기능 API(신고 처리, 모더레이션, 사용자/프로필 관리, 포인트/제재 등)
- 도메인 엔티티(`profiles`, `messages`, `reports`, `moderation_events`, `point_transactions`) 매핑
- 유효 JWT를 사용한 `GET /me` 성공 경로 e2e (테스트용 키쌍 + 로컬 JWKS 목 구성 필요)
