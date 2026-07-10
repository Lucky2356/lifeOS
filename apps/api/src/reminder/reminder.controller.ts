import { Controller, Post } from '@nestjs/common';
import { ReminderService } from './reminder.service';

@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminders: ReminderService) {}

  /** Ручной прогон движка напоминаний (аутентифицированно) — для проверки/администрирования. */
  @Post('run')
  run() {
    return this.reminders.run();
  }
}
