import type { AuditEntry, Household, HouseholdTask, Membership } from '@life-os/domain';

/** Порт хранилища Household OS (households, memberships, tasks, audit). */
export interface HouseholdRepository {
  createHousehold(h: Household): Promise<Household>;
  getHousehold(id: string): Promise<Household | null>;

  addMembership(m: Membership): Promise<Membership>;
  listMemberships(householdId: string): Promise<Membership[]>;
  findMembership(householdId: string, userId: string): Promise<Membership | null>;
  listMembershipsByUser(userId: string): Promise<Membership[]>;
  deactivateMembershipsByUser(userId: string, now: Date): Promise<number>;

  createTask(t: HouseholdTask): Promise<HouseholdTask>;
  listTasks(householdId: string): Promise<HouseholdTask[]>;
  getTask(householdId: string, id: string): Promise<HouseholdTask | null>;
  saveTask(t: HouseholdTask): Promise<HouseholdTask>;

  addAudit(e: AuditEntry): Promise<AuditEntry>;
  listAudit(householdId: string): Promise<AuditEntry[]>;
}

export const HOUSEHOLD_REPOSITORY = Symbol('HOUSEHOLD_REPOSITORY');
