import type { Database } from '../db/drizzle.provider';
import { reminderDeliveries } from '../db/schema';
import {
  deliveryKey,
  type ReminderDelivery,
  type ReminderDeliveryRepository,
} from './reminder-delivery.repository';

export class DrizzleReminderDeliveryRepository implements ReminderDeliveryRepository {
  constructor(private readonly db: Database) {}

  async listDeliveredKeys(): Promise<Set<string>> {
    const rows = await this.db
      .select({
        objectId: reminderDeliveries.objectId,
        offsetDays: reminderDeliveries.offsetDays,
        deadline: reminderDeliveries.deadline,
      })
      .from(reminderDeliveries);
    return new Set(rows.map((r) => deliveryKey(r.objectId, r.offsetDays, r.deadline)));
  }

  async recordMany(rows: ReminderDelivery[]): Promise<void> {
    if (rows.length === 0) return;
    // onConflictDoNothing — на случай гонки/повтора по уникальному (objectId, offsetDays, deadline).
    await this.db.insert(reminderDeliveries).values(rows).onConflictDoNothing();
  }
}
