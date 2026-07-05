import { describe, it, expect, beforeEach } from 'vitest';
import { AiService } from './ai.service';
import { AiSettingsRepository } from './ai-settings.repository';

const user = '00000000-0000-0000-0000-0000000000a1';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    service = new AiService(new AiSettingsRepository());
  });

  it('по умолчанию ИИ выключен → suggest бросает ai_disabled (core не деградирует)', async () => {
    await expect(
      service.suggest(user, { module: 'ledger', action: 'hint', context: '' }),
    ).rejects.toMatchObject({
      response: { code: 'ai_disabled' },
    });
  });

  it('после включения (без ключа) отдаёт Noop-предложение, помеченное как ИИ', async () => {
    await service.updateSettings(user, { globalEnabled: true });
    const s = await service.suggest(user, { module: 'ledger', action: 'hint', context: '' });
    expect(s.source).toBe('ai');
    expect(s.provider).toBe('noop');
  });

  it('household по умолчанию выключен даже при глобально включённом ИИ', async () => {
    await service.updateSettings(user, { globalEnabled: true });
    await expect(
      service.suggest(user, { module: 'household', action: 'hint', context: '' }),
    ).rejects.toMatchObject({ response: { code: 'ai_disabled' } });
  });

  it('настройки сохраняются', async () => {
    await service.updateSettings(user, { globalEnabled: true, shareSensitive: true });
    const settings = await service.getSettings(user);
    expect(settings.globalEnabled).toBe(true);
    expect(settings.shareSensitive).toBe(true);
  });
});
