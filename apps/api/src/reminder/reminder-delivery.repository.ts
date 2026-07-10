import { Injectable } from '@nestjs/common';

export interface ReminderDelivery {
  id: string;
  objectId: string;
  ownerUserId: string;
  offsetDays: number;
  deliveredAt: string;
}

export interface ReminderDeliveryRepository {
  /** Множество ключей `${objectId}:${offsetDays}` уже доставленных напоминаний. */
  listDeliveredKeys(): Promise<Set<string>>;
  recordMany(rows: ReminderDelivery[]): Promise<void>;
}

export const REMINDER_DELIVERY_REPOSITORY = Symbol('REMINDER_DELIVERY_REPOSITORY');

export const deliveryKey = (objectId: string, offsetDays: number) => `${objectId}:${offsetDays}`;

@Injectable()
export class InMemoryReminderDeliveryRepository implements ReminderDeliveryRepository {
  private readonly store = new Map<string, ReminderDelivery>();

  async listDeliveredKeys(): Promise<Set<string>> {
    return new Set([...this.store.values()].map((d) => deliveryKey(d.objectId, d.offsetDays)));
  }

  async recordMany(rows: ReminderDelivery[]): Promise<void> {
    for (const r of rows) this.store.set(deliveryKey(r.objectId, r.offsetDays), r);
  }
}
