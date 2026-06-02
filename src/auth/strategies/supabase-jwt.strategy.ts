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
