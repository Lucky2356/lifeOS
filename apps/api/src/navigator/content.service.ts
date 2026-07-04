import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import {
  startProgress,
  toggleStep,
  validateContentPack,
  type ContentPack,
  type Playbook,
  type PlaybookProgress,
} from '@life-os/domain';

@Injectable()
export class ContentService implements OnModuleInit {
  private pack!: ContentPack;
  private readonly progress = new Map<string, PlaybookProgress>();

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

  start(key: string, ownerUserId: string): PlaybookProgress {
    const playbook = this.getPlaybook(key);
    const existing = [...this.progress.values()].find(
      (p) => p.ownerUserId === ownerUserId && p.playbookKey === key,
    );
    if (existing) return existing;
    const progress = startProgress(playbook, this.pack, ownerUserId);
    this.progress.set(progress.id, progress);
    return progress;
  }

  listProgress(ownerUserId: string): PlaybookProgress[] {
    return [...this.progress.values()].filter((p) => p.ownerUserId === ownerUserId);
  }

  toggle(progressId: string, stepKey: string, ownerUserId: string): PlaybookProgress {
    const current = this.progress.get(progressId);
    if (!current || current.ownerUserId !== ownerUserId) throw new NotFoundException('Прогресс не найден');
    const updated = toggleStep(current, stepKey);
    this.progress.set(progressId, updated);
    return updated;
  }
}
