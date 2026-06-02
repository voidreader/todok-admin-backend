import { plainToInstance } from 'class-transformer';
import { IsString, IsUrl, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, require_protocol: true })
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
