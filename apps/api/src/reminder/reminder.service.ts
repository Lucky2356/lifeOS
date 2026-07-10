import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { computeReminders, daysUntil, defaultReminderRules, newId, type LifeObject } from '@life-os/domain';
import { logger } from '../common/logger';
import { LifeObjectService } from '../ledger/life-object.service';
import { USER_REPOSITORY, type UserRepository } from '../iam/user.repository';
import { EmailService } from '../iam/email.service';
import {
  REMINDER_DELIVERY_REPOSITORY,
  deliveryKey,
  type ReminderDelivery,
  type ReminderDeliveryRepository,
} from './reminder-delivery.repository';

export interface ReminderDigestItem {
  title: string;
  daysLeft: number; // отрицательное — просрочено
}

/**
 * Движок доставки напоминаний. Раз в сутки находит объекты, чьи пороги напоминаний (90/30/7/1 день)
 * наступили и ещё не доставлялись, и шлёт владельцу один email-дайджест. Дедуп — по таблице
 * reminder_deliveries. Чистые правила берём из доменного `computeReminders` (тот же расчёт, что в UI).
 */
@Injectable()
export class ReminderService {
  constructor(
    private readonly objects: LifeObjectService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REMINDER_DELIVERY_REPOSITORY) private readonly deliveries: ReminderDeliveryRepository,
    private readonly email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    const { sent } = await this.run();
    if (sent > 0) logger.info({ sent }, 'Напоминания: отправлены дайджесты');
  }

  /** Прогон движка. Возвращает число отправленных дайджестов (для теста/ручного запуска). */
  async run(now: Date = new Date()): Promise<{ sent: number }> {
    const objects = await this.objects.allWithDeadline();
    const delivered = await this.deliveries.listDeliveredKeys();

    // Сгруппировать сработавшие пороги по владельцу; объект в дайджесте — один раз.
    const byOwner = new Map<string, Map<string, LifeObject>>();
    const toRecordByOwner = new Map<string, ReminderDelivery[]>();

    for (const o of objects) {
      if (!o.validUntil) continue;
      for (const r of computeReminders(o.validUntil, defaultReminderRules)) {
        if (new Date(r.fireAt).getTime() > now.getTime()) continue; // порог ещё не наступил
        if (delivered.has(deliveryKey(o.id, r.offsetDays))) continue; // уже доставляли
        if (!byOwner.has(o.ownerUserId)) {
          byOwner.set(o.ownerUserId, new Map());
          toRecordByOwner.set(o.ownerUserId, []);
        }
        byOwner.get(o.ownerUserId)!.set(o.id, o);
        toRecordByOwner.get(o.ownerUserId)!.push({
          id: newId(),
          objectId: o.id,
          ownerUserId: o.ownerUserId,
          offsetDays: r.offsetDays,
          deliveredAt: now.toISOString(),
        });
      }
    }

    let sent = 0;
    for (const [ownerId, objMap] of byOwner) {
      const user = await this.users.findById(ownerId);
      if (!user || user.notifyEmail === false) continue; // уважаем настройку

      const items: ReminderDigestItem[] = [...objMap.values()].map((o) => ({
        title: o.title,
        daysLeft: daysUntil(o.validUntil, now) ?? 0,
      }));

      await this.email.sendReminderDigest(user.email, items);
      sent += 1;

      // Фиксируем доставку только если SMTP настроен — иначе догоним после настройки почты.
      if (this.email.configured) {
        await this.deliveries.recordMany(toRecordByOwner.get(ownerId) ?? []);
      }
    }
    return { sent };
  }
}
