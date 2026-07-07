import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
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

@Controller('objects')
export class LifeObjectController {
  constructor(private readonly service: LifeObjectService) {}

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
  upsert(@Body(new ZodValidationPipe(lifeObjectSchema)) obj: LifeObject, @CurrentUserId() userId: string) {
    return this.service.upsert(obj, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.remove(id, userId);
  }
}
