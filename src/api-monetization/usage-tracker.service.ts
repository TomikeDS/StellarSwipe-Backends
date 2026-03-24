import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { ApiUsage } from './entities/api-usage.entity';
import { BillingCycle, BillingCycleStatus } from './entities/billing-cycle.entity';
import { PricingTier } from './entities/pricing-tier.entity';
import { UsageMetric, UsageAggregate } from './interfaces/usage-metric.interface';
import { calculatePrice } from './utils/price-calculator';
import Big from 'big.js';

@Injectable()
export class UsageTrackerService {
  private readonly logger = new Logger(UsageTrackerService.name);

  constructor(
    @InjectRepository(ApiUsage)
    private readonly usageRepo: Repository<ApiUsage>,
    @InjectRepository(BillingCycle)
    private readonly billingCycleRepo: Repository<BillingCycle>,
    @InjectRepository(PricingTier)
    private readonly pricingTierRepo: Repository<PricingTier>,
  ) {}

  async track(metric: UsageMetric): Promise<void> {
    await this.usageRepo.save(this.usageRepo.create({
      apiKeyId: metric.apiKeyId,
      userId: metric.userId,
      endpoint: metric.endpoint,
      method: metric.method,
      statusCode: metric.statusCode,
      responseTimeMs: metric.responseTimeMs,
      ipAddress: metric.ipAddress,
      userAgent: metric.userAgent,
    }));

    await this.incrementBillingCycle(metric.apiKeyId, metric.userId);
  }

  async getUsageReport(
    apiKeyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageAggregate> {
    const records = await this.usageRepo.find({
      where: { apiKeyId, createdAt: Between(startDate, endDate) },
    });

    const endpointBreakdown: Record<string, number> = {};
    let totalResponseTime = 0;
    let successfulRequests = 0;

    for (const r of records) {
      endpointBreakdown[r.endpoint] = (endpointBreakdown[r.endpoint] ?? 0) + 1;
      totalResponseTime += r.responseTimeMs;
      if (r.statusCode < 400) successfulRequests++;
    }

    return {
      apiKeyId,
      userId: records[0]?.userId ?? '',
      periodStart: startDate,
      periodEnd: endDate,
      totalRequests: records.length,
      successfulRequests,
      failedRequests: records.length - successfulRequests,
      totalResponseTimeMs: totalResponseTime,
      endpointBreakdown,
    };
  }

  async getActiveBillingCycle(apiKeyId: string): Promise<BillingCycle | null> {
    return this.billingCycleRepo.findOne({
      where: { apiKeyId, status: BillingCycleStatus.ACTIVE },
    });
  }

  async aggregateUsageForCycle(billingCycleId: string): Promise<void> {
    const cycle = await this.billingCycleRepo.findOneOrFail({ where: { id: billingCycleId } });
    const tier = await this.pricingTierRepo.findOneOrFail({ where: { id: cycle.pricingTierId } });

    const count = await this.usageRepo.count({
      where: {
        apiKeyId: cycle.apiKeyId,
        createdAt: Between(cycle.periodStart, cycle.periodEnd),
      },
    });

    const result = calculatePrice(count, tier.includedRequests, tier.monthlyFlatFee, tier.overageRate);

    cycle.totalRequests = count;
    cycle.overageRequests = result.overageRequests;
    cycle.overageCost = result.overageCost.toFixed(6);
    cycle.totalCost = result.totalCost.toFixed(2);

    await this.billingCycleRepo.save(cycle);
    this.logger.log(`Aggregated usage for cycle ${billingCycleId}: ${count} requests, $${result.totalCost}`);
  }

  private async incrementBillingCycle(apiKeyId: string, userId: string): Promise<void> {
    let cycle = await this.billingCycleRepo.findOne({
      where: { apiKeyId, status: BillingCycleStatus.ACTIVE },
    });

    if (!cycle) {
      const tier = await this.pricingTierRepo.findOne({ where: { isActive: true } });
      if (!tier) return;

      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      cycle = this.billingCycleRepo.create({
        userId,
        apiKeyId,
        pricingTierId: tier.id,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        periodEnd,
        includedRequests: tier.includedRequests,
        flatFee: tier.monthlyFlatFee,
        totalRequests: 0,
        status: BillingCycleStatus.ACTIVE,
      });
    }

    cycle.totalRequests += 1;

    const tier = await this.pricingTierRepo.findOne({ where: { id: cycle.pricingTierId } });
    if (tier) {
      const overage = Math.max(0, cycle.totalRequests - cycle.includedRequests);
      cycle.overageRequests = overage;
      cycle.overageCost = new Big(overage).times(new Big(tier.overageRate)).toFixed(6);
      cycle.totalCost = new Big(cycle.flatFee).plus(new Big(cycle.overageCost)).toFixed(2);
    }

    await this.billingCycleRepo.save(cycle);
  }

  async getMonthlyUsage(userId: string, year: number, month: number): Promise<number> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return this.usageRepo.count({
      where: { userId, createdAt: Between(start, end) },
    });
  }

  async getTopEndpoints(
    apiKeyId: string,
    since: Date,
    limit = 10,
  ): Promise<Array<{ endpoint: string; count: number }>> {
    const records = await this.usageRepo.find({
      where: { apiKeyId, createdAt: MoreThanOrEqual(since) },
      select: ['endpoint'],
    });

    const counts: Record<string, number> = {};
    for (const r of records) {
      counts[r.endpoint] = (counts[r.endpoint] ?? 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }
}
