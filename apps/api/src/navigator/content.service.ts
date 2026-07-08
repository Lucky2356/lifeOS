import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Inject, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import {
  playbookProgressSchema,
  startProgress,
  toggleStep,
  validateContentPack,
  type ContentPack,
  type Playbook,
  type PlaybookProgress,
} from '@life-os/domain';
import { PROGRESS_REPOSITORY, type ProgressRepository } from './progress.repository';

@Injectable()
export class ContentService implements OnModuleInit {
  private pack!: ContentPack;

  constructor(@Inject(PROGRESS_REPOSITORY) private readonly progress: ProgressRepository) {}

  onModuleInit(): void {
    const dir = process.env.CONTENT_PACK_DIR ?? resolve(process.cwd(), '..', '..', 'content-packs');
    const raw = readFileSync(resolve(dir, 'ru', 'pack.json'), 'utf-8');
    this.pack = validateContentPack(JSON.parse(raw));
  }

  listPlaybooks(kind?: 'crisis' | 'bureaucracy'): Playbook[] {
    return kind ? this.pack.playbooks.filter((p) => p.kind === kind) : this.pack.playbooks;
  }

  getPlaybook(key: string): Playbook {
    const p = this.pack.playbooks.find((pb) => pb.key === key);
    if (!p) throw new NotFoundException('Плейбук не найден');
    return p;
  }

  async start(key: string, ownerUserId: string): Promise<PlaybookProgress> {
    const playbook = this.getPlaybook(key);
    const existing = await this.progress.findByOwnerAndKey(ownerUserId, key);
    if (existing) return existing;
    return this.progress.create(startProgress(playbook, this.pack, ownerUserId));
  }

  listProgress(ownerUserId: string): Promise<PlaybookProgress[]> {
    return this.progress.listByOwner(ownerUserId);
  }

  async toggle(progressId: string, stepKey: string, ownerUserId: string): Promise<PlaybookProgress> {
    const current = await this.progress.findById(progressId);
    if (!current || current.ownerUserId !== ownerUserId) throw new NotFoundException('Прогресс не найден');
    return this.progress.save(toggleStep(current, stepKey));
  }

  /**
   * Offline-first upsert прогресса (ADR 0003). Ключ — (владелец, playbookKey), чтобы клиентский
   * старт офлайн не плодил дублирующие записи. Разрешение конфликтов — LWW по порядку долива.
   */
  async upsertProgress(incoming: PlaybookProgress, ownerUserId: string): Promise<PlaybookProgress> {
    const p = playbookProgressSchema.parse({ ...incoming, ownerUserId });
    const existing = await this.progress.findByOwnerAndKey(ownerUserId, p.playbookKey);
    if (!existing) return this.progress.create(p);
    return this.progress.save({ ...existing, stepStates: p.stepStates, completedAt: p.completedAt });
  }
}
