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
