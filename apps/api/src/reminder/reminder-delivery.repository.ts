import { Injectable } from '@nestjs/common';

export interface ReminderDelivery {
  id: string;
  objectId: string;
  ownerUserId: string;
  offsetDays: number;
  deadline: string; // дедлайн (validUntil), для которого доставлено — часть ключа дедупа
  deliveredAt: string;
}

export interface ReminderDeliveryRepository {
  /** Множество ключей `${objectId}:${offsetDays}:${deadline}` уже доставленных напоминаний. */
  listDeliveredKeys(): Promise<Set<string>>;
  recordMany(rows: ReminderDelivery[]): Promise<void>;
}

export const REMINDER_DELIVERY_REPOSITORY = Symbol('REMINDER_DELIVERY_REPOSITORY');

/** Ключ дедупа включает дедлайн — при переносе срока пороги пере-взводятся. */
export const deliveryKey = (objectId: string, offsetDays: number, deadline: string) =>
  `${objectId}:${offsetDays}:${deadline}`;

@Injectable()
export class InMemoryReminderDeliveryRepository implements ReminderDeliveryRepository {
  private readonly store = new Map<string, ReminderDelivery>();

  async listDeliveredKeys(): Promise<Set<string>> {
    return new Set([...this.store.values()].map((d) => deliveryKey(d.objectId, d.offsetDays, d.deadline)));
  }

  async recordMany(rows: ReminderDelivery[]): Promise<void> {
    for (const r of rows) this.store.set(deliveryKey(r.objectId, r.offsetDays, r.deadline), r);
  }
}
