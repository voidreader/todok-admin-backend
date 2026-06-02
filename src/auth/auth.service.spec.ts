import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { AuthenticatedUser } from './types/authenticated-user';

describe('AuthService', () => {
  let service: AuthService;
  let findOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(AdminUser),
          useValue: { findOne } as Partial<Repository<AdminUser>>,
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  const baseUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    userId: '11111111-1111-1111-1111-111111111111',
    appMetadata: {},
    ...overrides,
  });

  it('app_metadata.role이 admin이면 테이블 조회 없이 true', async () => {
    const result = await service.isAdmin(baseUser({ appMetadata: { role: 'admin' } }));
    expect(result).toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('admin_users 테이블에 존재하면 true', async () => {
    findOne.mockResolvedValue({ userId: baseUser().userId } as AdminUser);
    const result = await service.isAdmin(baseUser());
    expect(result).toBe(true);
    expect(findOne).toHaveBeenCalledWith({ where: { userId: baseUser().userId } });
  });

  it('role도 아니고 테이블에도 없으면 false', async () => {
    findOne.mockResolvedValue(null);
    const result = await service.isAdmin(baseUser());
    expect(result).toBe(false);
  });
});
