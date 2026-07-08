import { describe, it, expect, beforeEach } from 'vitest';
import { scoreOptions } from '@life-os/domain';
import { DecisionService } from './decision.service';
import { InMemoryDecisionRepository } from './in-memory-decision.repository';

const userA = '00000000-0000-0000-0000-00000000000a';
const userB = '00000000-0000-0000-0000-00000000000b';

describe('DecisionService', () => {
  let service: DecisionService;
  beforeEach(() => {
    service = new DecisionService(new InMemoryDecisionRepository());
  });

  it('создаёт решение и находит его у владельца', async () => {
    const d = await service.create({ title: 'Сменить работу' }, userA);
    expect((await service.list(userA)).map((x) => x.id)).toContain(d.id);
  });

  it('изолирует решения между пользователями', async () => {
    await service.create({ title: 'Личное' }, userA);
    expect(await service.list(userB)).toHaveLength(0);
  });

  it('upsert создаёт по клиентскому id и применяет LWW по version', async () => {
    const local = await service.create({ title: 'Черновик' }, userA);
    // Клиент правит офлайн (version растёт) и доливает upsert-ом.
    const v1 = { ...local, title: 'Уточнено', version: 1 };
    const saved = await service.upsert(v1, userA);
    expect(saved.title).toBe('Уточнено');
    // Устаревшая запись (меньшая version) не затирает свежую.
    const stale = { ...local, title: 'Старое', version: 0 };
    const after = await service.upsert(stale, userA);
    expect(after.title).toBe('Уточнено');
  });

  it('upsert не даёт присвоить чужое решение', async () => {
    const mine = await service.create({ title: 'Моё' }, userA);
    await expect(service.upsert({ ...mine, version: 1 }, userB)).rejects.toThrow();
  });

  it('обновление критериев/вариантов даёт корректный взвешенный итог', async () => {
    const d = await service.create({ title: 'Купить авто' }, userA);
    const updated = await service.update(
      d.id,
      {
        criteria: [{ id: 'c1', label: 'Цена', weight: 3 }],
        options: [
          { id: 'o1', label: 'A', scores: { c1: 2 } },
          { id: 'o2', label: 'B', scores: { c1: 5 } },
        ],
      },
      userA,
    );
    const ranked = scoreOptions(updated);
    expect(ranked[0]?.optionId).toBe('o2');
    expect(updated.version).toBe(1);
  });
});
