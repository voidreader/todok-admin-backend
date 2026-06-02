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
    const options = typeOrmConfigFactory(config) as {
      type: string;
      url: string;
    };
    expect(options.type).toBe('postgres');
    expect(options.url).toContain('postgres://');
  });
});
