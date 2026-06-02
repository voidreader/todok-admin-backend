import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';

// jwks-rsa는 ESM 의존성(jose)을 포함하므로 Jest 환경에서 mock 처리
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn().mockReturnValue(() => {}),
}));

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
