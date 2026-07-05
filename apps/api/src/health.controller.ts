import { Controller, Get } from '@nestjs/common';
import { Public } from './iam/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string } {
    return { status: 'ok', service: 'life-os-api' };
  }
}
