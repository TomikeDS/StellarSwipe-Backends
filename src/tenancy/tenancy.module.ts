import { Module, Global } from '@nestjs/common';
import { TenantScopingService } from './tenant-scoping.service';

@Global()
@Module({
  providers: [TenantScopingService],
  exports: [TenantScopingService],
})
export class TenancyModule {}
