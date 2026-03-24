import { Module, Global } from '@nestjs/common';
import { SessionManagerService } from './session-manager.service';
import { InstanceCoordinatorService } from './instance-coordinator.service';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
    imports: [CacheModule],
    providers: [SessionManagerService, InstanceCoordinatorService],
    exports: [SessionManagerService, InstanceCoordinatorService],
})
export class ScalingModule { }
