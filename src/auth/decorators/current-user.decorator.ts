import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

export function getCurrentUser(
  _data: unknown,
  context: ExecutionContext,
): AuthenticatedUser {
  const request = context
    .switchToHttp()
    .getRequest<{ user: AuthenticatedUser }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(getCurrentUser);
