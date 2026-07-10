import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  createHouseholdTaskInputSchema,
  householdTaskSchema,
  relationshipSchema,
  roleSchema,
  type CreateHouseholdTaskInput,
  type HouseholdTask,
  type Relationship,
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
  relationship: relationshipSchema.default('other'),
  expiresAt: z.string().datetime().nullable().default(null),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  relationship: relationshipSchema,
  displayName: z.string().min(1).max(120).optional(),
  role: roleSchema.optional(),
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
    body: {
      userId: string;
      displayName: string;
      role: Role;
      relationship: Relationship;
      expiresAt: string | null;
    },
    @CurrentUserId() userId: string,
  ) {
    return this.service.addMember(id, userId, body);
  }

  /** Пригласить зарегистрированного пользователя по e-mail (добавляет реального человека). */
  @Post(':id/members/invite')
  invite(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inviteMemberSchema))
    body: { email: string; relationship: Relationship; displayName?: string; role?: Role },
    @CurrentUserId() userId: string,
  ) {
    return this.service.addMemberByEmail(id, userId, body);
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

  /** Offline-first upsert задачи дома по клиентскому id (ADR 0003). */
  @Put(':id/tasks/:taskId')
  upsertTask(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(householdTaskSchema)) task: HouseholdTask,
    @CurrentUserId() userId: string,
  ) {
    return this.service.upsertTask(id, userId, task);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.listAudit(id, userId);
  }
}
