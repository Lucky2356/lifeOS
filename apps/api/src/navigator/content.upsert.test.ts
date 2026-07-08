import { describe, it, expect, beforeEach } from 'vitest';
import type { PlaybookProgress } from '@life-os/domain';
import { ContentService } from './content.service';
import { InMemoryProgressRepository } from './progress.repository';

const userA = '00000000-0000-0000-0000-00000000000a';

function progress(over: Partial<PlaybookProgress> = {}): PlaybookProgress {
  return {
    id: '01920000-0000-7000-8000-000000000001',
    ownerUserId: userA,
    packId: 'ru',
    packVersion: '1',
    playbookKey: 'job-loss',
    stepStates: { s1: false, s2: false },
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...over,
  };
}

describe('ContentService.upsertProgress (offline-first)', () => {
  let service: ContentService;
  beforeEach(() => {
    // onModuleInit (загрузка пака) не нужен: upsert работает только с репозиторием прогресса.
    service = new ContentService(new InMemoryProgressRepository());
  });

  it('создаёт прогресс по клиентскому состоянию', async () => {
    const saved = await service.upsertProgress(progress({ stepStates: { s1: true, s2: false } }), userA);
    expect(saved.stepStates.s1).toBe(true);
    expect((await service.listProgress(userA)).length).toBe(1);
  });

  it('не плодит дубликаты по (владелец, playbookKey), а обновляет существующий', async () => {
    await service.upsertProgress(progress(), userA);
    // Новый клиентский id, тот же playbookKey — должна остаться одна запись.
    await service.upsertProgress(
      progress({ id: '01920000-0000-7000-8000-000000000002', stepStates: { s1: true, s2: true } }),
      userA,
    );
    const list = await service.listProgress(userA);
    expect(list).toHaveLength(1);
    expect(list[0]?.stepStates).toEqual({ s1: true, s2: true });
  });
});
