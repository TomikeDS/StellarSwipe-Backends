import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BillingService } from '../billing.service';

export const GENERATE_INVOICES_QUEUE = 'generate-invoices';

@Processor(GENERATE_INVOICES_QUEUE)
export class GenerateInvoicesJob {
  private readonly logger = new Logger(GenerateInvoicesJob.name);

  constructor(private readonly billingService: BillingService) {}

  @Process('generate-all')
  async handleGenerateAll(): Promise<{ generated: number; errors: number }> {
    const result = await this.billingService.generateAllPendingInvoices();
    this.logger.log(`Invoice generation: ${result.generated} generated, ${result.errors} errors`);
    return result;
  }

  @Process('generate-for-user')
  async handleGenerateForUser(
    job: Job<{ userId: string; billingCycleId: string }>,
  ): Promise<void> {
    await this.billingService.generateInvoice(job.data.userId, job.data.billingCycleId);
    this.logger.log(`Invoice generated for user ${job.data.userId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
