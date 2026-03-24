import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ProviderEarning } from '../entities/provider-earning.entity';
import { Payout, PayoutStatus } from '../entities/payout.entity';
import { CreateEarningDto, EarningsSummaryDto } from '../dto/earnings-summary.dto';

export const PROVIDER_FEE_RATE = 0.001; // 0.1%
export const MINIMUM_PAYOUT_THRESHOLD = 10; // USD equivalent

@Injectable()
export class ProviderRewardsService {
  private readonly logger = new Logger(ProviderRewardsService.name);

  constructor(
    @InjectRepository(ProviderEarning)
    private readonly earningRepository: Repository<ProviderEarning>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculate provider fee from a traded amount (0.1%)
   */
  calculateProviderFee(tradedAmount: number): number {
    return Number((tradedAmount * PROVIDER_FEE_RATE).toFixed(8));
  }

  /**
   * Record a new earning when a signal copy trade executes.
   * Idempotent: duplicate tradeId is silently ignored.
   */
  async recordEarning(dto: CreateEarningDto): Promise<ProviderEarning> {
    const existing = await this.earningRepository.findOne({
      where: { tradeId: dto.tradeId },
    });

    if (existing) {
      this.logger.warn(`Earning for tradeId ${dto.tradeId} already recorded`);
      return existing;
    }

    const amount = this.calculateProviderFee(dto.tradedAmount);

    const earning = this.earningRepository.create({
      providerId: dto.providerId,
      signalId: dto.signalId,
      tradeId: dto.tradeId,
      tradedAmount: dto.tradedAmount,
      amount,
      asset: dto.asset,
      isPaidOut: false,
    });

    const saved = await this.earningRepository.save(earning);
    this.logger.log(
      `Earning recorded: provider=${dto.providerId} amount=${amount} ${dto.asset} trade=${dto.tradeId}`,
    );
    return saved;
  }

  /**
   * Get full earnings dashboard summary for a provider.
   */
  async getEarningsSummary(providerId: string): Promise<EarningsSummaryDto> {
    const [allEarnings, recentEarnings] = await Promise.all([
      this.earningRepository.find({ where: { providerId } }),
      this.earningRepository.find({
        where: { providerId },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const totalEarned = allEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidOut = allEarnings
      .filter((e) => e.isPaidOut)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const pendingPayouts = await this.payoutRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.providerId = :providerId', { providerId })
      .andWhere('p.status IN (:...statuses)', {
        statuses: [PayoutStatus.PENDING, PayoutStatus.PROCESSING],
      })
      .getRawOne<{ total: string }>();

    const pendingAmount = Number(pendingPayouts?.total ?? 0);
    const availableBalance = Number((totalEarned - paidOut - pendingAmount).toFixed(8));

    return {
      providerId,
      totalEarned: Number(totalEarned.toFixed(8)),
      availableBalance,
      paidOut: Number(paidOut.toFixed(8)),
      pendingPayouts: pendingAmount,
      earningsCount: allEarnings.length,
      recentEarnings: recentEarnings.map((e) => ({
        id: e.id,
        providerId: e.providerId,
        signalId: e.signalId,
        tradeId: e.tradeId,
        amount: Number(e.amount),
        tradedAmount: Number(e.tradedAmount),
        asset: e.asset,
        isPaidOut: e.isPaidOut,
        createdAt: e.createdAt,
      })),
      canRequestPayout: availableBalance >= MINIMUM_PAYOUT_THRESHOLD,
      minimumPayoutThreshold: MINIMUM_PAYOUT_THRESHOLD,
    };
  }

  /**
   * Get available (unpaid, non-pending) balance for a provider.
   */
  async getAvailableBalance(providerId: string): Promise<number> {
    const summary = await this.getEarningsSummary(providerId);
    return summary.availableBalance;
  }

  /**
   * Mark earnings as paid out after a successful payout.
   * Uses a transaction to atomically update earnings.
   */
  async markEarningsAsPaidOut(
    providerId: string,
    payoutId: string,
    amount: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const unpaidEarnings = await manager.find(ProviderEarning, {
        where: { providerId, isPaidOut: false, payoutId: IsNull() },
        order: { createdAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      let remaining = amount;
      const toUpdate: ProviderEarning[] = [];

      for (const earning of unpaidEarnings) {
        if (remaining <= 0) break;
        remaining -= Number(earning.amount);
        earning.isPaidOut = true;
        earning.payoutId = payoutId;
        toUpdate.push(earning);
      }

      if (toUpdate.length > 0) {
        await manager.save(ProviderEarning, toUpdate);
      }
    });
  }

  /**
   * Get paginated earnings list for a provider.
   */
  async getEarningsList(
    providerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: ProviderEarning[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.earningRepository.findAndCount({
      where: { providerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
