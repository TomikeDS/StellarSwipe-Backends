import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLoggingInterceptor } from './interceptors/audit-logging.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditLoggingInterceptor],
  exports: [AuditService, AuditLoggingInterceptor],
})
export class AuditModule {}
