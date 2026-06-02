import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// jwks-rsa는 ESM 의존성(jose@6)을 포함하므로 Jest 환경에서 mock 처리한다.
// 토큰 없는 요청의 401 검증에는 JWKS 실제 동작이 필요 없다.
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn().mockReturnValue(() => {}),
}));

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
