import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RebalancingService } from '../services/rebalancing.service';

export const REBALANCING_QUEUE = 'rebalancing';
export const CHECK_REBALANCING_JOB = 'check-rebalancing';

export interface CheckRebalancingJobData {
  userId: string;
  /** Override auto-execute behaviour for this run */
  forceAutoExecute?: boolean;
}

/**
 * Bull queue processor that runs periodic portfolio drift checks.
 *
 * Schedule jobs via BullModule queue:
 *   queue.add(CHECK_REBALANCING_JOB, { userId }, { repeat: { cron: '0 * * * *' } })
 *
 * The job:
 *  1. Creates a rebalancing plan for the user.
 *  2. If the user has autoRebalance enabled (or forceAutoExecute), trades are executed.
 *  3. Otherwise the plan is stored pending manual approval.
 */
@Processor(REBALANCING_QUEUE)
export class CheckRebalancingJob {
  private readonly logger = new Logger(CheckRebalancingJob.name);

  constructor(private readonly rebalancingService: RebalancingService) {}

  @Process(CHECK_REBALANCING_JOB)
  async handle(job: Job<CheckRebalancingJobData>): Promise<void> {
    const { userId, forceAutoExecute = false } = job.data;

    this.logger.log(`[Job ${job.id}] Checking rebalancing for user ${userId}`);

    // First quickly check if drift exceeds threshold to avoid unnecessary plan building
    let drift;
    try {
      drift = await this.rebalancingService.analyzeDrift(userId);
    } catch (err) {
      // User may not have a target config yet – skip silently
      this.logger.warn(
        `[Job ${job.id}] No target allocation for user ${userId}: ${(err as Error).message}`,
      );
      return;
    }

    if (!drift.rebalancingRequired) {
      this.logger.log(
        `[Job ${job.id}] Drift ${drift.maxDriftPercent.toFixed(2)}% within threshold for ${userId} – skipping`,
      );
      return;
    }

    this.logger.log(
      `[Job ${job.id}] Drift ${drift.maxDriftPercent.toFixed(2)}% exceeds threshold for ${userId} – building plan`,
    );

    const plan = await this.rebalancingService.createRebalancingPlan(
      userId,
      forceAutoExecute,
    );

    this.logger.log(
      `[Job ${job.id}] Plan ${plan.planId} created with status=${plan.status}, trades=${plan.proposedTrades.length}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<CheckRebalancingJobData>, error: Error): void {
    this.logger.error(
      `[Job ${job.id}] Rebalancing check FAILED for user ${job.data.userId}: ${error.message}`,
      error.stack,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<CheckRebalancingJobData>): void {
    this.logger.log(
      `[Job ${job.id}] Rebalancing check completed for user ${job.data.userId}`,
    );
  }
}
