import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Trade, TradeStatus } from '../../trades/entities/trade.entity';
import { PriceService } from '../../shared/price.service';
import {
  AssetAllocationStateDto,
  DriftAnalysisDto,
} from '../dto/rebalancing-plan.dto';
import { AllocationItemDto } from '../dto/target-allocation.dto';

export interface AssetPosition {
  assetCode: string;
  assetIssuer?: string;
  /** Total quantity currently held (sum of open buy trades) */
  quantity: number;
  /** Current price in USD */
  priceUsd: number;
  /** Current value in USD */
  valueUsd: number;
}

@Injectable()
export class AllocationAnalyzerService {
  private readonly logger = new Logger(AllocationAnalyzerService.name);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly priceService: PriceService,
  ) {}

  /**
   * Calculate each asset's current quantity and value from open trades.
   */
  async computeAssetPositions(userId: string): Promise<AssetPosition[]> {
    const openTrades = await this.tradeRepository.find({
      where: {
        userId,
        status: In([TradeStatus.PENDING, TradeStatus.EXECUTING]),
      },
    });

    if (openTrades.length === 0) {
      this.logger.debug(`No open trades found for user ${userId}`);
      return [];
    }

    // Aggregate quantities by asset
    const assetMap: Map<string, { code: string; issuer?: string; qty: number }> = new Map();

    for (const trade of openTrades) {
      const key = trade.baseAsset;
      const existing = assetMap.get(key);
      const qty = Number(trade.amount);

      if (existing) {
        existing.qty += qty;
      } else {
        assetMap.set(key, { code: trade.baseAsset, qty });
      }
    }

    // Fetch prices in a single batch
    const symbols = Array.from(assetMap.keys()).map((code) => `${code}/USD`);
    const prices = await this.priceService.getMultiplePrices(symbols);

    const positions: AssetPosition[] = [];
    for (const [code, data] of assetMap.entries()) {
      const priceKey = `${code}/USD`;
      const priceUsd = prices[priceKey] ?? 0;
      positions.push({
        assetCode: data.code,
        assetIssuer: data.issuer,
        quantity: data.qty,
        priceUsd,
        valueUsd: data.qty * priceUsd,
      });
    }

    return positions;
  }

  /**
   * Compute the current percentage allocation of each asset and determine drift
   * against the user-supplied target allocations.
   */
  computeAllocationState(
    positions: AssetPosition[],
    targets: AllocationItemDto[],
  ): { totalValueUsd: number; states: AssetAllocationStateDto[] } {
    const totalValueUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);

    // Build a map for quick target lookup
    const targetMap = new Map<string, AllocationItemDto>();
    for (const t of targets) {
      targetMap.set(t.assetCode.toUpperCase(), t);
    }

    // For each *target* asset, find its current position (may be zero)
    const states: AssetAllocationStateDto[] = [];

    // Track which position assets are covered
    const coveredAssets = new Set<string>();

    for (const target of targets) {
      const code = target.assetCode.toUpperCase();
      const position = positions.find(
        (p) => p.assetCode.toUpperCase() === code,
      );

      const currentValue = position?.valueUsd ?? 0;
      const currentPercentage =
        totalValueUsd > 0 ? (currentValue / totalValueUsd) * 100 : 0;
      const driftPercent = currentPercentage - target.targetPercentage;

      states.push({
        assetCode: target.assetCode,
        assetIssuer: target.assetIssuer,
        currentValue,
        currentPercentage,
        targetPercentage: target.targetPercentage,
        driftPercent,
        requiresRebalancing: false, // filled in by the caller with threshold
      });

      coveredAssets.add(code);
    }

    // Include any positions NOT in the target list (100% over-allocation)
    for (const position of positions) {
      const code = position.assetCode.toUpperCase();
      if (!coveredAssets.has(code)) {
        const currentPercentage =
          totalValueUsd > 0 ? (position.valueUsd / totalValueUsd) * 100 : 0;
        states.push({
          assetCode: position.assetCode,
          assetIssuer: position.assetIssuer,
          currentValue: position.valueUsd,
          currentPercentage,
          targetPercentage: 0, // not in target → should be fully sold
          driftPercent: currentPercentage,
          requiresRebalancing: false,
        });
      }
    }

    return { totalValueUsd, states };
  }

  /**
   * Apply the drift threshold to mark which assets need rebalancing.
   */
  applyDriftThreshold(
    states: AssetAllocationStateDto[],
    thresholdPercent: number,
  ): AssetAllocationStateDto[] {
    return states.map((s) => ({
      ...s,
      requiresRebalancing: Math.abs(s.driftPercent) >= thresholdPercent,
    }));
  }

  /**
   * Full drift analysis for a user given their target allocations.
   */
  async analyzeDrift(
    userId: string,
    targets: AllocationItemDto[],
    driftThresholdPercent: number,
  ): Promise<DriftAnalysisDto> {
    const positions = await this.computeAssetPositions(userId);
    const { totalValueUsd, states } = this.computeAllocationState(positions, targets);
    const statesWithThreshold = this.applyDriftThreshold(states, driftThresholdPercent);
    const maxDriftPercent = Math.max(...statesWithThreshold.map((s) => Math.abs(s.driftPercent)), 0);
    const rebalancingRequired = statesWithThreshold.some((s) => s.requiresRebalancing);

    this.logger.log(
      `Drift analysis for ${userId}: totalValue=$${totalValueUsd.toFixed(2)}, maxDrift=${maxDriftPercent.toFixed(2)}%, rebalancingRequired=${rebalancingRequired}`,
    );

    return {
      userId,
      analysedAt: new Date(),
      portfolioValueUsd: totalValueUsd,
      currentAllocations: statesWithThreshold,
      maxDriftPercent,
      driftThresholdPercent,
      rebalancingRequired,
    };
  }
}
