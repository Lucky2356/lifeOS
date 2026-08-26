import { describe, it, expect } from 'vitest';
import { backupIsStale, backupStaleDays, lastBackupAt, rememberBackup } from './backup';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('напоминание о резервной копии', () => {
  it('без единой копии напоминает', () => {
    expect(backupIsStale(null)).toBe(true);
  });

  it('свежая копия молчит', () => {
    expect(backupIsStale(daysAgo(1))).toBe(false);
    expect(backupIsStale(daysAgo(backupStaleDays - 1))).toBe(false);
  });

  it('старая копия снова напоминает', () => {
    expect(backupIsStale(daysAgo(backupStaleDays + 1))).toBe(true);
  });

  it('отметка о копии сохраняется и читается', async () => {
    expect(await lastBackupAt()).toBeNull();
    const at = new Date('2026-08-26T10:00:00.000Z');
    await rememberBackup(at);
    expect(await lastBackupAt()).toBe(at.toISOString());
    expect(backupIsStale(await lastBackupAt(), at)).toBe(false);
  });
});
