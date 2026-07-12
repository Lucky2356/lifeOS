import { describe, it, expect, beforeEach } from 'vitest';
import { createLifeObject, objectTypes } from '@life-os/domain';
import { ReminderService } from './reminder.service';
import { LifeObjectService } from '../ledger/life-object.service';
import { InMemoryLifeObjectRepository } from '../ledger/in-memory-life-object.repository';
import { InMemoryUserRepository, type User } from '../iam/user.repository';
import { InMemoryReminderDeliveryRepository } from './reminder-delivery.repository';
import type { EmailService } from '../iam/email.service';

const userId = '00000000-0000-0000-0000-0000000000a1';

function makeUser(over: Partial<User> = {}): User {
  return {
    id: userId,
    email: 'a@b.co',
    passwordHash: 'x',
    mfaEnabled: false,
    mfaSecretEnc: null,
    status: 'active',
    locale: 'ru',
    createdAt: new Date().toISOString(),
    notifyEmail: true,
    ...over,
  };
}

describe('ReminderService', () => {
  let objectsRepo: InMemoryLifeObjectRepository;
  let usersRepo: InMemoryUserRepository;
  let deliveries: InMemoryReminderDeliveryRepository;
  let sent: Array<{ to: string; items: Array<{ title: string; daysLeft: number }> }>;
  let service: ReminderService;

  beforeEach(() => {
    objectsRepo = new InMemoryLifeObjectRepository();
    usersRepo = new InMemoryUserRepository();
    deliveries = new InMemoryReminderDeliveryRepository();
    sent = [];
    const email = {
      configured: true,
      sendReminderDigest: async (to: string, items: Array<{ title: string; daysLeft: number }>) => {
        sent.push({ to, items });
      },
    } as unknown as EmailService;
    service = new ReminderService(new LifeObjectService(objectsRepo), usersRepo, deliveries, email);
  });

  async function addObjectDueInDays(days: number, title = 'Загранпаспорт') {
    const validUntil = new Date(Date.now() + days * 86_400_000).toISOString();
    return objectsRepo.create(createLifeObject({ type: objectTypes[0], title, validUntil }, userId));
  }

  it('шлёт дайджест по сработавшим порогам и не дублирует при повторном прогоне', async () => {
    await usersRepo.create(makeUser());
    await addObjectDueInDays(5); // пороги 90/30/7 уже пройдены

    const first = await service.run();
    expect(first.sent).toBe(1);
    expect(sent[0]?.items[0]?.title).toBe('Загранпаспорт');
    expect(sent[0]?.items).toHaveLength(1); // объект в дайджесте один раз

    const second = await service.run();
    expect(second.sent).toBe(0); // всё уже доставлено — дублей нет
  });

  it('не шлёт, если пользователь отключил email-уведомления', async () => {
    await usersRepo.create(makeUser({ notifyEmail: false }));
    await addObjectDueInDays(5);
    const res = await service.run();
    expect(res.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('не шлёт, если ни один порог ещё не наступил', async () => {
    await usersRepo.create(makeUser());
    await addObjectDueInDays(200); // до 90-дневного порога ещё далеко
    const res = await service.run();
    expect(res.sent).toBe(0);
  });

  it('перенос дедлайна пере-взводит напоминания (новый дедлайн — новые ключи)', async () => {
    await usersRepo.create(makeUser());
    const obj = await addObjectDueInDays(5);
    expect((await service.run()).sent).toBe(1);
    expect((await service.run()).sent).toBe(0); // повтор без изменений — тишина

    // Продлеваем срок: те же пороги для НОВОГО дедлайна должны сработать заново.
    const newValidUntil = new Date(Date.now() + 6 * 86_400_000).toISOString();
    await objectsRepo.save({ ...obj, validUntil: newValidUntil });
    expect((await service.run()).sent).toBe(1);
  });

  it('сбой отправки одному не срывает рассылку остальным', async () => {
    const userB = '00000000-0000-0000-0000-0000000000b2';
    await usersRepo.create(makeUser());
    await usersRepo.create(makeUser({ id: userB, email: 'bad@b.co' }));
    await objectsRepo.create(
      createLifeObject(
        {
          type: objectTypes[0],
          title: 'Мой',
          validUntil: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        },
        userId,
      ),
    );
    await objectsRepo.create(
      createLifeObject(
        {
          type: objectTypes[0],
          title: 'Чужой',
          validUntil: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        },
        userB,
      ),
    );
    const failing = {
      configured: true,
      sendReminderDigest: async (to: string) => {
        if (to === 'bad@b.co') throw new Error('SMTP bounce');
        sent.push({ to, items: [] });
      },
    } as unknown as EmailService;
    const svc = new ReminderService(new LifeObjectService(objectsRepo), usersRepo, deliveries, failing);

    const res = await svc.run();
    expect(res.sent).toBe(1); // один прошёл, несмотря на падение другого
    expect(sent.map((s) => s.to)).toEqual(['a@b.co']);
  });
});
