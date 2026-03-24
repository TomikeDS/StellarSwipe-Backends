import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ApiUsage } from './entities/api-usage.entity';
import { BillingCycle } from './entities/billing-cycle.entity';
import { Invoice } from './entities/invoice.entity';
import { PricingTier } from './entities/pricing-tier.entity';
import { UsageTrackerService } from './usage-tracker.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { UsageTrackingMiddleware } from './middleware/usage-tracking.middleware';
import { AggregateUsageJob, AGGREGATE_USAGE_QUEUE } from './jobs/aggregate-usage.job';
import { GenerateInvoicesJob, GENERATE_INVOICES_QUEUE } from './jobs/generate-invoices.job';
import { ProcessPaymentsJob, PROCESS_PAYMENTS_QUEUE } from './jobs/process-payments.job';
import { QuotaEnforcer } from './utils/quota-enforcer';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage, BillingCycle, Invoice, PricingTier]),
    BullModule.registerQueue(
      { name: AGGREGATE_USAGE_QUEUE },
      { name: GENERATE_INVOICES_QUEUE },
      { name: PROCESS_PAYMENTS_QUEUE },
    ),
  ],
  providers: [
    UsageTrackerService,
    BillingService,
    QuotaEnforcer,
    AggregateUsageJob,
    GenerateInvoicesJob,
    ProcessPaymentsJob,
  ],
  controllers: [BillingController],
  exports: [UsageTrackerService, BillingService, QuotaEnforcer],
})
export class ApiMonetizationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UsageTrackingMiddleware).forRoutes('*');
  }
}
