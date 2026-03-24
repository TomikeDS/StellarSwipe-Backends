import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

import { SecurityAlert } from './entities/security-alert.entity';
import { SecurityIncident } from './entities/security-incident.entity';
import { SecurityMonitorService } from './monitoring/security-monitor.service';
import { AnomalyDetectorService } from './monitoring/anomaly-detector.service';
import { AlertManagerService } from './monitoring/alert-manager.service';
import { SecurityDashboardController } from './security-dashboard.controller';

// ML-based trading anomaly detection
import { Anomaly } from './anomaly-detection/entities/anomaly.entity';
import { FraudAlert } from './anomaly-detection/entities/fraud-alert.entity';
import { Investigation } from './anomaly-detection/entities/investigation.entity';
import { TradingAnomalyDetectorService } from './anomaly-detection/anomaly-detector.service';
import { FraudAnalyzerService } from './anomaly-detection/fraud-analyzer.service';
import { ScanForAnomaliesJob } from './anomaly-detection/jobs/scan-for-anomalies.job';
import { InvestigateAlertsJob } from './anomaly-detection/jobs/investigate-alerts.job';
import { Trade } from '../trades/entities/trade.entity';
import { Signal } from '../signals/entities/signal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityAlert,
      SecurityIncident,
      // ML anomaly detection entities
      Anomaly,
      FraudAlert,
      Investigation,
      Trade,
      Signal,
    ]),
    EventEmitterModule,
    CacheModule.register(),
    ScheduleModule.forRoot(),
  ],
  controllers: [SecurityDashboardController],
  providers: [
    SecurityMonitorService,
    AnomalyDetectorService,
    AlertManagerService,
    // ML-based trading anomaly detection
    TradingAnomalyDetectorService,
    FraudAnalyzerService,
    ScanForAnomaliesJob,
    InvestigateAlertsJob,
  ],
  exports: [SecurityMonitorService, TradingAnomalyDetectorService, FraudAnalyzerService],
})
export class SecurityMonitoringModule {}
