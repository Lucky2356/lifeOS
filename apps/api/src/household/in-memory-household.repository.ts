import { Injectable } from '@nestjs/common';
import type { AuditEntry, Household, HouseholdTask, Membership } from '@life-os/domain';
import type { HouseholdRepository } from './household.repository';

@Injectable()
export class InMemoryHouseholdRepository implements HouseholdRepository {
  private readonly households = new Map<string, Household>();
  private readonly memberships = new Map<string, Membership>();
  private readonly tasks = new Map<string, HouseholdTask>();
  private readonly audit: AuditEntry[] = [];

  async createHousehold(h: Household): Promise<Household> {
    this.households.set(h.id, h);
    return h;
  }

  async getHousehold(id: string): Promise<Household | null> {
    return this.households.get(id) ?? null;
  }

  async addMembership(m: Membership): Promise<Membership> {
    this.memberships.set(m.id, m);
    return m;
  }

  async listMemberships(householdId: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter(
      (m) => m.householdId === householdId && m.deletedAt === null,
    );
  }

  async findMembership(householdId: string, userId: string): Promise<Membership | null> {
    return (
      [...this.memberships.values()].find(
        (m) => m.householdId === householdId && m.userId === userId && m.deletedAt === null,
      ) ?? null
    );
  }

  async listMembershipsByUser(userId: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter((m) => m.userId === userId && m.deletedAt === null);
  }

  async createTask(t: HouseholdTask): Promise<HouseholdTask> {
    this.tasks.set(t.id, t);
    return t;
  }

  async listTasks(householdId: string): Promise<HouseholdTask[]> {
    return [...this.tasks.values()]
      .filter((t) => t.householdId === householdId && t.deletedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getTask(householdId: string, id: string): Promise<HouseholdTask | null> {
    const t = this.tasks.get(id);
    return t && t.householdId === householdId && t.deletedAt === null ? t : null;
  }

  async saveTask(t: HouseholdTask): Promise<HouseholdTask> {
    this.tasks.set(t.id, t);
    return t;
  }

  async addAudit(e: AuditEntry): Promise<AuditEntry> {
    this.audit.push(e);
    return e;
  }

  async listAudit(householdId: string): Promise<AuditEntry[]> {
    return this.audit.filter((e) => e.householdId === householdId).sort((a, b) => b.at.localeCompare(a.at));
  }
}
