import { describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceService } from './maintenance.service';
import { InMemorySessionRepository, type Session } from './session.repository';
import { InMemoryResetTokenRepository, type ResetToken } from './reset-token.repository';

const userId = '00000000-0000-0000-0000-0000000000a1';
const iso = (ms: number) => new Date(ms).toISOString();

function session(id: string, expiresAt: string): Session {
  return {
    id,
    userId,
    refreshHash: 'h',
    createdAt: iso(0),
    expiresAt,
    revokedAt: null,
    lastSeenAt: iso(0),
    userAgent: 'x',
  };
}
function token(id: string, expiresAt: string, usedAt: string | null): ResetToken {
  return { id, userId, tokenHash: id, createdAt: iso(0), expiresAt, usedAt };
}

describe('MaintenanceService', () => {
  let sessions: InMemorySessionRepository;
  let tokens: InMemoryResetTokenRepository;
  let service: MaintenanceService;
  const now = new Date('2026-07-12T00:00:00.000Z');

  beforeEach(() => {
    sessions = new InMemorySessionRepository();
    tokens = new InMemoryResetTokenRepository();
    service = new MaintenanceService(sessions, tokens);
  });

  it('удаляет протухшие сессии, оставляя действующие', async () => {
    await sessions.create(session('s-old', '2026-07-11T00:00:00.000Z')); // истекла
    await sessions.create(session('s-live', '2026-08-01T00:00:00.000Z')); // жива
    const res = await service.run(now);
    expect(res.sessions).toBe(1);
    expect(await sessions.findById('s-old')).toBeNull();
    expect(await sessions.findById('s-live')).not.toBeNull();
  });

  it('удаляет использованные и просроченные reset-токены', async () => {
    await tokens.create(token('t-used', '2026-08-01T00:00:00.000Z', iso(1))); // использован
    await tokens.create(token('t-exp', '2026-07-11T00:00:00.000Z', null)); // просрочен
    await tokens.create(token('t-live', '2026-08-01T00:00:00.000Z', null)); // жив
    const res = await service.run(now);
    expect(res.tokens).toBe(2);
    expect(await tokens.findByHash('t-live')).not.toBeNull();
  });
});
