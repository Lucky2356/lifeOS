import { Controller, ForbiddenException, Post } from '@nestjs/common';
import { ReminderService } from './reminder.service';

@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminders: ReminderService) {}

  /**
   * Ручной прогон движка напоминаний — рассылает дайджесты ВСЕМ владельцам, поэтому это
   * админ/dev-операция. Доступна только при ENABLE_DEV_ENDPOINTS=true, иначе 403 (чтобы обычный
   * аутентифицированный пользователь не мог триггерить массовую рассылку). Штатно работает @Cron.
   */
  @Post('run')
  run() {
    if (process.env.ENABLE_DEV_ENDPOINTS !== 'true') {
      throw new ForbiddenException('Ручной запуск отключён (задайте ENABLE_DEV_ENDPOINTS=true)');
    }
    return this.reminders.run();
  }
}
