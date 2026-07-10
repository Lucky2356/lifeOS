import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';

const notificationsSchema = z.object({ notifyEmail: z.boolean() });

@Controller('account')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get('export')
  exportAll(@CurrentUserId() userId: string) {
    return this.service.exportAll(userId);
  }

  @Get('notifications')
  getNotifications(@CurrentUserId() userId: string) {
    return this.service.getNotifications(userId);
  }

  @Patch('notifications')
  setNotifications(
    @Body(new ZodValidationPipe(notificationsSchema)) body: { notifyEmail: boolean },
    @CurrentUserId() userId: string,
  ) {
    return this.service.setNotifications(userId, body.notifyEmail);
  }

  @Delete()
  @HttpCode(200)
  deleteAll(@CurrentUserId() userId: string) {
    return this.service.deleteAll(userId);
  }
}
