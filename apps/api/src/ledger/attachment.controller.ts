import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { maxAttachmentBytes } from '@life-os/domain';
import { CurrentUserId } from '../common/current-user.decorator';
import { AttachmentService, type UploadedFile as UF } from './attachment.service';

@Controller()
export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  @Post('objects/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxAttachmentBytes } }))
  upload(@Param('id') id: string, @UploadedFile() file: UF | undefined, @CurrentUserId() userId: string) {
    return this.service.upload(id, userId, file);
  }

  @Get('objects/:id/attachments')
  list(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.list(id, userId);
  }

  @Get('attachments/:id')
  async download(@Param('id') id: string, @CurrentUserId() userId: string, @Res() res: Response) {
    const { meta, content } = await this.service.download(id, userId);
    res.set({
      'Content-Type': meta.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
      'Content-Length': String(content.length),
    });
    res.send(content);
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.remove(id, userId);
  }
}
