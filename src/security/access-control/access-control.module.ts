import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { IpWhitelist } from './entities/ip-whitelist.entity';
import { GeoRestriction } from './entities/geo-restriction.entity';
import { AccessAttemptLog } from './entities/access-attempt-log.entity';
import { TemporaryAccessCode } from './entities/temporary-access-code.entity';
import { IpWhitelistService } from './ip-whitelist.service';
import { GeofencingService } from './geofencing.service';
import { AccessControlService } from './access-control.service';
import { AccessControlGuard } from './access-control.guard';
import { AccessControlController } from './access-control.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      IpWhitelist,
      GeoRestriction,
      AccessAttemptLog,
      TemporaryAccessCode,
    ]),
    EventEmitterModule,
  ],
  controllers: [AccessControlController],
  providers: [
    IpWhitelistService,
    GeofencingService,
    AccessControlService,
    AccessControlGuard,
  ],
  exports: [
    AccessControlService,
    IpWhitelistService,
    GeofencingService,
    AccessControlGuard,
  ],
})
export class AccessControlModule {}
