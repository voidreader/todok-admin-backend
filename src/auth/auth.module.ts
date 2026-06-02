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
