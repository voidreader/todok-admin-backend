import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user';

describe('AdminGuard', () => {
  const user: AuthenticatedUser = {
    userId: '44444444-4444-4444-4444-444444444444',
    appMetadata: {},
  };

  const makeContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const makeGuard = (isAdmin: boolean) => {
    const authService = { isAdmin: jest.fn().mockResolvedValue(isAdmin) } as unknown as AuthService;
    const guard = new AdminGuard(authService);
    // 부모(AuthGuard)의 인증 통과를 가정한다.
    const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);
    return { guard, authService };
  };

  afterEach(() => jest.restoreAllMocks());

  it('인증 통과 + 어드민이면 true', async () => {
    const { guard } = makeGuard(true);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('인증 통과 + 어드민 아니면 ForbiddenException', async () => {
    const { guard } = makeGuard(false);
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
