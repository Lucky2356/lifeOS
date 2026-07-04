import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createLifeObjectInputSchema,
  updateLifeObjectInputSchema,
  type CreateLifeObjectInput,
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

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.remove(id, userId);
  }
}
