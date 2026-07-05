import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get('export')
  exportAll(@CurrentUserId() userId: string) {
    return this.service.exportAll(userId);
  }

  @Delete()
  @HttpCode(200)
  deleteAll(@CurrentUserId() userId: string) {
    return this.service.deleteAll(userId);
  }
}
