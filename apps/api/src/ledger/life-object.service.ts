import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  applyLifeObjectUpdate,
  createLifeObject,
  type CreateLifeObjectInput,
  type LifeObject,
  type UpdateLifeObjectInput,
} from '@life-os/domain';
import { LIFE_OBJECT_REPOSITORY, type LifeObjectRepository } from './life-object.repository';

@Injectable()
export class LifeObjectService {
  constructor(@Inject(LIFE_OBJECT_REPOSITORY) private readonly repo: LifeObjectRepository) {}

  create(input: CreateLifeObjectInput, ownerUserId: string): Promise<LifeObject> {
    return this.repo.create(createLifeObject(input, ownerUserId));
  }

  list(ownerUserId: string): Promise<LifeObject[]> {
    return this.repo.findAllByOwner(ownerUserId);
  }

  async get(id: string, ownerUserId: string): Promise<LifeObject> {
    const found = await this.repo.findById(id, ownerUserId);
    if (!found) throw new NotFoundException('Объект не найден');
    return found;
  }

  async update(id: string, patch: UpdateLifeObjectInput, ownerUserId: string): Promise<LifeObject> {
    const current = await this.get(id, ownerUserId);
    return this.repo.save(applyLifeObjectUpdate(current, patch));
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    const ok = await this.repo.softDelete(id, ownerUserId, new Date());
    if (!ok) throw new NotFoundException('Объект не найден');
  }

  /** Удалить все объекты владельца (право на забвение). */
  deleteAllForOwner(ownerUserId: string): Promise<number> {
    return this.repo.softDeleteAllByOwner(ownerUserId, new Date());
  }
}
