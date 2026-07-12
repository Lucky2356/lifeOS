import { describe, it, expect, beforeEach } from 'vitest';
import { AccountService } from './account.service';
import { LifeObjectService } from '../ledger/life-object.service';
import { InMemoryLifeObjectRepository } from '../ledger/in-memory-life-object.repository';
import { DecisionService } from '../decision/decision.service';
import { InMemoryDecisionRepository } from '../decision/in-memory-decision.repository';
import { HouseholdService } from '../household/household.service';
import { InMemoryHouseholdRepository } from '../household/in-memory-household.repository';
import { AiService } from '../ai/ai.service';
import { InMemoryAiSettingsRepository } from '../ai/ai-settings.repository';
import type { AttachmentService } from '../ledger/attachment.service';

const user = '00000000-0000-0000-0000-0000000000a1';

describe('AccountService', () => {
  let ledger: LifeObjectService;
  let decisions: DecisionService;
  let households: HouseholdService;
  let ai: AiService;
  let account: AccountService;

  beforeEach(() => {
    ledger = new LifeObjectService(new InMemoryLifeObjectRepository());
    decisions = new DecisionService(new InMemoryDecisionRepository());
    households = new HouseholdService(new InMemoryHouseholdRepository());
    ai = new AiService(new InMemoryAiSettingsRepository());
    const attachments = { removeAllForOwner: async () => {} } as unknown as AttachmentService;
    account = new AccountService(ledger, decisions, households, ai, undefined!, attachments);
  });

  it('экспорт собирает данные пользователя', async () => {
    await ledger.create({ type: 'document', title: 'Паспорт' }, user);
    await decisions.create({ title: 'Решение' }, user);
    await households.create('Дом', user, 'Алекс');

    const dump = await account.exportAll(user);
    expect(dump.objects).toHaveLength(1);
    expect(dump.decisions).toHaveLength(1);
    expect(dump.households).toHaveLength(1);
    expect(dump.aiSettings.globalEnabled).toBe(false);
  });

  it('удаление стирает данные пользователя во всех модулях', async () => {
    await ledger.create({ type: 'document', title: 'Паспорт' }, user);
    await decisions.create({ title: 'Решение' }, user);
    await households.create('Дом', user, 'Алекс');

    const res = await account.deleteAll(user);
    expect(res.deletedObjects).toBe(1);
    expect(res.deletedDecisions).toBe(1);
    expect(res.removedMemberships).toBe(1);

    expect(await ledger.list(user)).toHaveLength(0);
    expect(await decisions.list(user)).toHaveLength(0);
    expect(await households.listForUser(user)).toHaveLength(0);
  });
});
