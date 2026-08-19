import { z } from 'zod';
import { baseEntitySchema } from './sync';
import { newId } from './ids';

export const taskStatusSchema = z.enum(['open', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Общая бытовая задача дома (кто/что/когда). */
export const householdTaskSchema = baseEntitySchema.extend({
  householdId: z.string().uuid(),
  title: z.string().min(1).max(200),
  assigneeMembershipId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: taskStatusSchema,
});
export type HouseholdTask = z.infer<typeof householdTaskSchema>;

export const createHouseholdTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  assigneeMembershipId: z.string().uuid().nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
});
export type CreateHouseholdTaskInput = z.input<typeof createHouseholdTaskInputSchema>;

export function createHouseholdTask(
  input: CreateHouseholdTaskInput,
  householdId: string,
  now: Date = new Date(),
): HouseholdTask {
  const parsed = createHouseholdTaskInputSchema.parse(input);
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    version: 0,
    deletedAt: null,
    householdId,
    title: parsed.title,
    assigneeMembershipId: parsed.assigneeMembershipId,
    dueAt: parsed.dueAt,
    status: 'open',
  };
}

export function toggleTaskStatus(task: HouseholdTask, now: Date = new Date()): HouseholdTask {
  return {
    ...task,
    status: task.status === 'open' ? 'done' : 'open',
    updatedAt: now.toISOString(),
    version: task.version + 1,
  };
}
