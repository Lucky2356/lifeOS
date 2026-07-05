import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  createHouseholdTaskInputSchema,
  roleSchema,
  type CreateHouseholdTaskInput,
  type Role,
} from '@life-os/domain';
import { z } from 'zod';
import { CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HouseholdService } from './household.service';

const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120).default('Вы'),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  role: roleSchema,
  expiresAt: z.string().datetime().nullable().default(null),
});

@Controller('households')
export class HouseholdController {
  constructor(private readonly service: HouseholdService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createHouseholdSchema)) body: { name: string; displayName: string },
    @CurrentUserId() userId: string,
  ) {
    return this.service.create(body.name, userId, body.displayName);
  }

  @Get()
  listMine(@CurrentUserId() userId: string) {
    return this.service.listForUser(userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.get(id, userId);
  }

  @Get(':id/members')
  members(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.listMembers(id, userId);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addMemberSchema))
    body: { userId: string; displayName: string; role: Role; expiresAt: string | null },
    @CurrentUserId() userId: string,
  ) {
    return this.service.addMember(id, userId, body);
  }

  @Get(':id/tasks')
  tasks(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.listTasks(id, userId);
  }

  @Post(':id/tasks')
  createTask(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createHouseholdTaskInputSchema)) input: CreateHouseholdTaskInput,
    @CurrentUserId() userId: string,
  ) {
    return this.service.createTask(id, userId, input);
  }

  @Post(':id/tasks/:taskId/toggle')
  toggleTask(@Param('id') id: string, @Param('taskId') taskId: string, @CurrentUserId() userId: string) {
    return this.service.toggleTask(id, taskId, userId);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.listAudit(id, userId);
  }
}
