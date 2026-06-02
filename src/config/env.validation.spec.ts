import 'reflect-metadata';
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
    const rest = { SUPABASE_URL: valid.SUPABASE_URL };
    expect(() => validateEnv(rest)).toThrow();
  });

  it('SUPABASE_URL이 URL 형식이 아니면 예외를 던진다', () => {
    expect(() =>
      validateEnv({ ...valid, SUPABASE_URL: 'not-a-url' }),
    ).toThrow();
  });
});
