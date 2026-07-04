import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { NavigatorController } from './navigator.controller';

@Module({
  controllers: [NavigatorController],
  providers: [ContentService],
})
export class NavigatorModule {}
