import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { IamModule } from '../iam/iam.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { DrizzleReminderDeliveryRepository } from './drizzle-reminder-delivery.repository';
import {
  InMemoryReminderDeliveryRepository,
  REMINDER_DELIVERY_REPOSITORY,
} from './reminder-delivery.repository';

@Module({
  imports: [LedgerModule, IamModule],
  controllers: [ReminderController],
  providers: [
    ReminderService,
    {
      provide: REMINDER_DELIVERY_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleReminderDeliveryRepository(db) : new InMemoryReminderDeliveryRepository(),
    },
  ],
})
export class ReminderModule {}
