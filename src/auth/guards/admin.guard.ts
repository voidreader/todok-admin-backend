import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class AdminGuard extends AuthGuard('supabase-jwt') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) JWT 인증 (실패 시 passport가 UnauthorizedException)
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) {
      return false;
    }

    // 2) 어드민 인가
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const isAdmin = await this.authService.isAdmin(request.user);
    if (!isAdmin) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}
