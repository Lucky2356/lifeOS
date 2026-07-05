import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { ContentService } from './content.service';

@Controller('content')
export class NavigatorController {
  constructor(private readonly content: ContentService) {}

  @Get('playbooks')
  list(@Query('kind') kind?: string) {
    const filter = kind === 'crisis' || kind === 'bureaucracy' ? kind : undefined;
    return this.content.listPlaybooks(filter);
  }

  @Get('playbooks/:key')
  get(@Param('key') key: string) {
    return this.content.getPlaybook(key);
  }

  @Post('playbooks/:key/start')
  start(@Param('key') key: string, @CurrentUserId() userId: string) {
    return this.content.start(key, userId);
  }

  @Get('progress')
  progress(@CurrentUserId() userId: string) {
    return this.content.listProgress(userId);
  }

  @Post('progress/:id/steps/:stepKey/toggle')
  toggle(@Param('id') id: string, @Param('stepKey') stepKey: string, @CurrentUserId() userId: string) {
    return this.content.toggle(id, stepKey, userId);
  }
}
