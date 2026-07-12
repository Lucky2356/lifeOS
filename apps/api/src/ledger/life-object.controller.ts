import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  createLifeObjectInputSchema,
  lifeObjectSchema,
  updateLifeObjectInputSchema,
  type CreateLifeObjectInput,
  type LifeObject,
  type UpdateLifeObjectInput,
} from '@life-os/domain';
import { CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LifeObjectService } from './life-object.service';
import { AttachmentService } from './attachment.service';

@Controller('objects')
export class LifeObjectController {
  constructor(
    private readonly service: LifeObjectService,
    private readonly attachments: AttachmentService,
  ) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createLifeObjectInputSchema)) input: CreateLifeObjectInput,
    @CurrentUserId() userId: string,
  ) {
    return this.service.create(input, userId);
  }

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.service.list(userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.get(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLifeObjectInputSchema)) patch: UpdateLifeObjectInput,
    @CurrentUserId() userId: string,
  ) {
    return this.service.update(id, patch, userId);
  }

  /** Offline-first upsert: клиент присылает полный объект со своим id (ADR 0003). */
  @Put(':id')
  upsert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(lifeObjectSchema)) obj: LifeObject,
    @CurrentUserId() userId: string,
  ) {
    // id в пути (ключ дедупа outbox) должен совпадать с id в теле.
    if (obj.id !== id) throw new BadRequestException('id в пути и в теле не совпадают');
    return this.service.upsert(obj, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    await this.service.remove(id, userId); // валидирует владельца и наличие
    await this.attachments.removeForObject(id); // каскад: стереть вложения (файлы + записи)
  }
}
