import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  createDecisionInputSchema,
  decisionSchema,
  updateDecisionInputSchema,
  type CreateDecisionInput,
  type Decision,
  type UpdateDecisionInput,
} from '@life-os/domain';
import { CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DecisionService } from './decision.service';

@Controller('decisions')
export class DecisionController {
  constructor(private readonly service: DecisionService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createDecisionInputSchema)) input: CreateDecisionInput,
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
    @Body(new ZodValidationPipe(updateDecisionInputSchema)) patch: UpdateDecisionInput,
    @CurrentUserId() userId: string,
  ) {
    return this.service.update(id, patch, userId);
  }

  /** Offline-first upsert: клиент присылает полное решение со своим id (ADR 0003). */
  @Put(':id')
  upsert(@Body(new ZodValidationPipe(decisionSchema)) decision: Decision, @CurrentUserId() userId: string) {
    return this.service.upsert(decision, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.remove(id, userId);
  }
}
