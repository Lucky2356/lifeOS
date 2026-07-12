import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DecisionService } from '../decision/decision.service';
import { HouseholdService } from '../household/household.service';
import { LifeObjectService } from '../ledger/life-object.service';
import { AttachmentService } from '../ledger/attachment.service';
import { USER_REPOSITORY, type UserRepository } from '../iam/user.repository';

@Injectable()
export class AccountService {
  constructor(
    private readonly ledger: LifeObjectService,
    private readonly decisions: DecisionService,
    private readonly households: HouseholdService,
    private readonly ai: AiService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly attachments: AttachmentService,
  ) {}

  async getNotifications(userId: string): Promise<{ notifyEmail: boolean }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return { notifyEmail: user.notifyEmail };
  }

  async setNotifications(userId: string, notifyEmail: boolean): Promise<{ notifyEmail: boolean }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    user.notifyEmail = notifyEmail;
    await this.users.save(user);
    return { notifyEmail };
  }

  /** Экспорт всех данных пользователя (переносимость данных). */
  async exportAll(userId: string) {
    const [objects, decisions, households, aiSettings] = await Promise.all([
      this.ledger.list(userId),
      this.decisions.list(userId),
      this.households.listForUser(userId),
      this.ai.getSettings(userId),
    ]);
    return { exportedAt: new Date().toISOString(), userId, objects, decisions, households, aiSettings };
  }

  /** Полное удаление данных пользователя («право на забвение»). */
  async deleteAll(userId: string) {
    const [deletedObjects, deletedDecisions, removedMemberships] = await Promise.all([
      this.ledger.deleteAllForOwner(userId),
      this.decisions.deleteAllForOwner(userId),
      this.households.leaveAll(userId),
    ]);
    await this.ai.resetSettings(userId);
    await this.attachments.removeAllForOwner(userId); // каскад: файлы вложений + записи
    return { deletedObjects, deletedDecisions, removedMemberships };
  }
}
