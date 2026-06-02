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
