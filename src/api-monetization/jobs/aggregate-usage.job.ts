import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { UsageTrackerService } from '../usage-tracker.service';

export const AGGREGATE_USAGE_QUEUE = 'aggregate-usage';

@Processor(AGGREGATE_USAGE_QUEUE)
export class AggregateUsageJob {
  private readonly logger = new Logger(AggregateUsageJob.name);

  constructor(private readonly usageTracker: UsageTrackerService) {}

  @Process('aggregate-cycle')
  async handleAggregateCycle(job: Job<{ billingCycleId: string }>): Promise<void> {
    await this.usageTracker.aggregateUsageForCycle(job.data.billingCycleId);
    this.logger.log(`Aggregated usage for cycle ${job.data.billingCycleId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
