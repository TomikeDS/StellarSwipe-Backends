import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { BillingCycle, BillingCycleStatus } from './entities/billing-cycle.entity';
import { PricingTier, PricingTierName } from './entities/pricing-tier.entity';
import { UsageTrackerService } from './usage-tracker.service';
import { BillingSummaryDto } from './dto/billing-summary.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(BillingCycle)
    private readonly billingCycleRepo: Repository<BillingCycle>,
    @InjectRepository(PricingTier)
    private readonly pricingTierRepo: Repository<PricingTier>,
    private readonly usageTracker: UsageTrackerService,
  ) {}

  async getBillingSummary(userId: string, apiKeyId: string): Promise<BillingSummaryDto> {
    const cycle = await this.billingCycleRepo.findOne({
      where: { userId, apiKeyId, status: BillingCycleStatus.ACTIVE },
    });

    if (!cycle) throw new NotFoundException('No active billing cycle found');

    const tier = await this.pricingTierRepo.findOneOrFail({ where: { id: cycle.pricingTierId } });
    const pendingInvoices = await this.invoiceRepo.count({
      where: { userId, status: InvoiceStatus.ISSUED },
    });

    return {
      userId,
      apiKeyId,
      currentTier: tier.name,
      billingCycleId: cycle.id,
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      totalRequests: cycle.totalRequests,
      includedRequests: cycle.includedRequests,
      overageRequests: cycle.overageRequests,
      flatFee: cycle.flatFee,
      overageCost: cycle.overageCost,
      totalCost: cycle.totalCost,
      pendingInvoices,
    };
  }

  async generateInvoice(userId: string, billingCycleId: string): Promise<Invoice> {
    const cycle = await this.billingCycleRepo.findOneOrFail({ where: { id: billingCycleId, userId } });
    const tier = await this.pricingTierRepo.findOneOrFail({ where: { id: cycle.pricingTierId } });

    await this.usageTracker.aggregateUsageForCycle(billingCycleId);
    await this.billingCycleRepo.reload(cycle);

    const invoiceNumber = `INV-${Date.now()}-${userId.slice(0, 8).toUpperCase()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const lineItems = [
      {
        description: `${tier.name} plan — ${cycle.periodStart.toISOString().slice(0, 7)}`,
        quantity: 1,
        unitPrice: cycle.flatFee,
        total: cycle.flatFee,
      },
    ];

    if (cycle.overageRequests > 0) {
      lineItems.push({
        description: `Overage: ${cycle.overageRequests} requests @ $${tier.overageRate}/req`,
        quantity: cycle.overageRequests,
        unitPrice: tier.overageRate,
        total: cycle.overageCost,
      });
    }

    const invoice = this.invoiceRepo.create({
      userId,
      billingCycleId,
      invoiceNumber,
      amountDue: cycle.totalCost,
      dueDate,
      lineItems,
      status: InvoiceStatus.ISSUED,
    });

    await this.invoiceRepo.save(invoice);
    cycle.status = BillingCycleStatus.INVOICED;
    await this.billingCycleRepo.save(cycle);

    this.logger.log(`Invoice ${invoiceNumber} generated for user ${userId}: $${cycle.totalCost}`);
    return invoice;
  }

  async markInvoicePaid(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOneOrFail({ where: { id: invoiceId } });
    invoice.status = InvoiceStatus.PAID;
    invoice.amountPaid = invoice.amountDue;
    invoice.paidAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPricingTiers(): Promise<PricingTier[]> {
    return this.pricingTierRepo.find({ where: { isActive: true } });
  }

  async assignTier(userId: string, apiKeyId: string, tierName: PricingTierName): Promise<BillingCycle> {
    const tier = await this.pricingTierRepo.findOneOrFail({ where: { name: tierName } });

    // Close existing active cycle
    const existing = await this.billingCycleRepo.findOne({
      where: { userId, apiKeyId, status: BillingCycleStatus.ACTIVE },
    });
    if (existing) {
      existing.status = BillingCycleStatus.CLOSED;
      await this.billingCycleRepo.save(existing);
    }

    const now = new Date();
    const cycle = this.billingCycleRepo.create({
      userId,
      apiKeyId,
      pricingTierId: tier.id,
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      includedRequests: tier.includedRequests,
      flatFee: tier.monthlyFlatFee,
      totalRequests: 0,
      status: BillingCycleStatus.ACTIVE,
    });

    return this.billingCycleRepo.save(cycle);
  }

  async generateAllPendingInvoices(): Promise<{ generated: number; errors: number }> {
    const closedCycles = await this.billingCycleRepo.find({
      where: { status: BillingCycleStatus.CLOSED },
    });

    let generated = 0;
    let errors = 0;

    for (const cycle of closedCycles) {
      try {
        await this.generateInvoice(cycle.userId, cycle.id);
        generated++;
      } catch (err) {
        this.logger.error(`Failed to generate invoice for cycle ${cycle.id}: ${(err as Error).message}`);
        errors++;
      }
    }

    return { generated, errors };
  }
}
