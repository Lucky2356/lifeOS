import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Помечает маршрут как доступный без аутентификации (обходит глобальный JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
