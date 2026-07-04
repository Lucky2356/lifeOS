import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Валидация тела запроса доменными Zod-схемами на границе API (защита от инъекций/мусора). */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Проверьте введённые данные',
        issues: result.error.flatten(),
      });
    }
    return result.data;
  }
}
