import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('me')
export class MeController {
  @UseGuards(AdminGuard)
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.userId, email: user.email };
  }
}
