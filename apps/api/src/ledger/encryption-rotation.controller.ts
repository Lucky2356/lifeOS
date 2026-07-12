import { Controller, ForbiddenException, Post } from '@nestjs/common';
import { EncryptionRotationService } from './encryption-rotation.service';

@Controller('admin')
export class EncryptionRotationController {
  constructor(private readonly rotation: EncryptionRotationService) {}

  /**
   * Перешифровать данные на текущий ключ (после добавления нового ключа в ENCRYPTION_KEYS).
   * Админ/dev-операция — только при ENABLE_DEV_ENDPOINTS=true (иначе 403).
   */
  @Post('rotate-keys')
  rotate() {
    if (process.env.ENABLE_DEV_ENDPOINTS !== 'true') {
      throw new ForbiddenException('Ротация отключена (задайте ENABLE_DEV_ENDPOINTS=true)');
    }
    return this.rotation.run();
  }
}
