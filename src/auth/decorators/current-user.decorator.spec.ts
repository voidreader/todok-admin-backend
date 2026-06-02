import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

describe('getCurrentUser', () => {
  it('request.user를 반환한다', () => {
    const user: AuthenticatedUser = {
      userId: '55555555-5555-5555-5555-555555555555',
      appMetadata: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(getCurrentUser(undefined, context)).toBe(user);
  });
});
