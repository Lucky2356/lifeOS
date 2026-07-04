import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { LedgerModule } from './ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [HealthController],
})
export class AppModule {}
