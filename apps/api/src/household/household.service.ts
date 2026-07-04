import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  can,
  createAuditEntry,
  createHousehold,
  createHouseholdTask,
  createMembership,
  isMembershipActive,
  toggleTaskStatus,
  type CreateHouseholdTaskInput,
  type Household,
  type HouseholdTask,
  type Membership,
  type Role,
} from '@life-os/domain';
import { HOUSEHOLD_REPOSITORY, type HouseholdRepository } from './household.repository';

@Injectable()
export class HouseholdService {
  constructor(@Inject(HOUSEHOLD_REPOSITORY) private readonly repo: HouseholdRepository) {}

  private async requireMembership(householdId: string, userId: string): Promise<Membership> {
    const m = await this.repo.findMembership(householdId, userId);
    if (!m || !isMembershipActive(m)) {
      throw new ForbiddenException('Нет доступа к этому дому');
    }
    return m;
  }

  private ensure(role: Role, action: Parameters<typeof can>[1]): void {
    if (!can(role, action)) throw new ForbiddenException('Недостаточно прав');
  }

  async create(name: string, userId: string, displayName: string): Promise<Household> {
    const household = createHousehold(name, userId);
    await this.repo.createHousehold(household);
    await this.repo.addMembership(
      createMembership({ householdId: household.id, userId, displayName, role: 'owner' }),
    );
    return household;
  }

  async listForUser(userId: string): Promise<Household[]> {
    const memberships = await this.repo.listMembershipsByUser(userId);
    const active = memberships.filter((m) => isMembershipActive(m));
    const households = await Promise.all(active.map((m) => this.repo.getHousehold(m.householdId)));
    return households.filter((h): h is Household => h !== null);
  }

  async get(id: string, userId: string): Promise<Household> {
    await this.requireMembership(id, userId);
    const h = await this.repo.getHousehold(id);
    if (!h) throw new NotFoundException('Дом не найден');
    return h;
  }

  async listMembers(id: string, userId: string): Promise<Membership[]> {
    await this.requireMembership(id, userId);
    return this.repo.listMemberships(id);
  }

  async addMember(
    id: string,
    userId: string,
    input: { userId: string; displayName: string; role: Role; expiresAt?: string | null },
  ): Promise<Membership> {
    const me = await this.requireMembership(id, userId);
    this.ensure(me.role, 'manage_members');
    const membership = createMembership({ householdId: id, ...input });
    await this.repo.addMembership(membership);
    await this.repo.addAudit(
      createAuditEntry({
        householdId: id,
        actorUserId: userId,
        action: 'add_member',
        resourceType: 'membership',
        resourceId: membership.id,
      }),
    );
    return membership;
  }

  async listTasks(id: string, userId: string): Promise<HouseholdTask[]> {
    await this.requireMembership(id, userId);
    return this.repo.listTasks(id);
  }

  async createTask(id: string, userId: string, input: CreateHouseholdTaskInput): Promise<HouseholdTask> {
    const me = await this.requireMembership(id, userId);
    this.ensure(me.role, 'create_task');
    const task = createHouseholdTask(input, id);
    await this.repo.createTask(task);
    await this.repo.addAudit(
      createAuditEntry({
        householdId: id,
        actorUserId: userId,
        action: 'create_task',
        resourceType: 'task',
        resourceId: task.id,
      }),
    );
    return task;
  }

  async toggleTask(id: string, taskId: string, userId: string): Promise<HouseholdTask> {
    const me = await this.requireMembership(id, userId);
    this.ensure(me.role, 'complete_task');
    const task = await this.repo.getTask(id, taskId);
    if (!task) throw new NotFoundException('Задача не найдена');
    const toggled = toggleTaskStatus(task);
    await this.repo.saveTask(toggled);
    await this.repo.addAudit(
      createAuditEntry({
        householdId: id,
        actorUserId: userId,
        action: 'toggle_task',
        resourceType: 'task',
        resourceId: task.id,
      }),
    );
    return toggled;
  }

  async listAudit(id: string, userId: string) {
    const me = await this.requireMembership(id, userId);
    this.ensure(me.role, 'view_audit');
    return this.repo.listAudit(id);
  }
}
