import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';

import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { AllocationAnalyzerService } from './services/allocation-analyzer.service';
import { RebalancingService } from './services/rebalancing.service';
import { CheckRebalancingJob, REBALANCING_QUEUE } from './jobs/check-rebalancing.job';

import { Trade } from '../trades/entities/trade.entity';
import { Position } from './entities/position.entity';
import { PnlHistory } from './entities/pnl-history.entity';
import { User } from '../users/entities/user.entity';
import { PriceService } from '../shared/price.service';
import { CacheModule } from '@nestjs/cache-manager';
import { PnlCalculatorService } from './services/pnl-calculator.service';
import { PerformanceTrackerService } from './services/performance-tracker.service';
import { ExportService } from './services/export.service';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from '../common/services/notification.service';
import { RateLimitService } from '../common/services/rate-limit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, Position, User, PnlHistory]),
    CacheModule.register(),
    BullModule.registerQueue({
      name: 'export-history',
    }),
  ],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    PriceService,
    PnlCalculatorService,
    PerformanceTrackerService,
    ExportService,
    NotificationService,
    RateLimitService,
  ],
  exports: [PortfolioService, PnlCalculatorService, PerformanceTrackerService, ExportService],
})
export class PortfolioModule { }
