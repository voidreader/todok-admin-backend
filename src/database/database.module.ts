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
    // Supabase는 TLS 연결을 요구한다. 현재는 인증서 검증을 비활성화하지만,
    // 운영 환경에서는 MITM 방지를 위해 Supabase CA를 사용한
    // { ca, rejectUnauthorized: true } 구성으로 강화하는 것을 권장한다.
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
