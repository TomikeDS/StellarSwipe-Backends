import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BillingService } from '../billing.service';

export const PROCESS_PAYMENTS_QUEUE = 'process-payments';

@Processor(PROCESS_PAYMENTS_QUEUE)
export class ProcessPaymentsJob {
  private readonly logger = new Logger(ProcessPaymentsJob.name);

  constructor(private readonly billingService: BillingService) {}

  @Process('mark-paid')
  async handleMarkPaid(job: Job<{ invoiceId: string }>): Promise<void> {
    await this.billingService.markInvoicePaid(job.data.invoiceId);
    this.logger.log(`Invoice ${job.data.invoiceId} marked as paid`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
