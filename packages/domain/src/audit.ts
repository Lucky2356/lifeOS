import { z } from 'zod';
import { newId } from './ids';

/** Неизменяемая запись журнала доступа к данным дома (docs/SECURITY.md). */
export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  at: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export function createAuditEntry(
  input: {
    householdId: string;
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
  },
  now: Date = new Date(),
): AuditEntry {
  return {
    id: newId(),
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    at: now.toISOString(),
  };
}
