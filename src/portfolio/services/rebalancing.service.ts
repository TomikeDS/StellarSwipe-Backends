import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeStatus, TradeSide } from '../../trades/entities/trade.entity';
import { PriceService } from '../../shared/price.service';
import {
  AllocationItemDto,
  SetTargetAllocationDto,
  TargetAllocationResponseDto,
} from '../dto/target-allocation.dto';
import {
  AssetAllocationStateDto,
  DriftAnalysisDto,
  RebalancingExecutionResultDto,
  RebalancingPlanDto,
  RebalancingStatus,
  RebalancingTradeAction,
  RebalancingTradeDto,
} from '../dto/rebalancing-plan.dto';
import { AllocationAnalyzerService } from './allocation-analyzer.service';

/** In-memory store for target allocations (per user). In production,
 *  this would be persisted in a dedicated DB table / entity. */
interface TargetConfig {
  allocations: AllocationItemDto[];
  driftThresholdPercent: number;
  autoRebalance: boolean;
  updatedAt: Date;
}

/** Estimated fee rate per trade (0.1 % of trade value) */
const FEE_RATE = 0.001;

/** Minimum trade value in USD – trades below this are skipped to avoid dust */
const MIN_TRADE_VALUE_USD = 0.5;

/** Counter-asset used when rebalancing (USDC-equivalent on Stellar) */
const COUNTER_ASSET_CODE = 'USDC';
const COUNTER_ASSET_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

@Injectable()
export class RebalancingService {
  private readonly logger = new Logger(RebalancingService.name);

  /** Per-user target-allocation configuration (in-memory cache).
   *  Replace with a TypeORM entity for production persistence. */
  private readonly targetConfigs: Map<string, TargetConfig> = new Map();

  /** In-memory plan store keyed by planId so callers can approve & execute later */
  private readonly pendingPlans: Map<string, RebalancingPlanDto> = new Map();

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly priceService: PriceService,
    private readonly allocationAnalyzer: AllocationAnalyzerService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // TARGET ALLOCATION CONFIG
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Persist (in-memory) the user's target allocation configuration.
   * Validates that percentages sum to 100.
   */
  setTargetAllocation(
    userId: string,
    dto: SetTargetAllocationDto,
  ): TargetAllocationResponseDto {
    this.validateAllocationSum(dto.allocations);

    const config: TargetConfig = {
      allocations: dto.allocations.map((a) => ({
        ...a,
        assetCode: a.assetCode.toUpperCase(),
      })),
      driftThresholdPercent: dto.driftThresholdPercent ?? 5,
      autoRebalance: dto.autoRebalance ?? false,
      updatedAt: new Date(),
    };

    this.targetConfigs.set(userId, config);
    this.logger.log(`Target allocation set for user ${userId}: ${JSON.stringify(config.allocations)}`);

    return {
      userId,
      allocations: config.allocations,
      driftThresholdPercent: config.driftThresholdPercent,
      autoRebalance: config.autoRebalance,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Retrieve the stored target allocation for a user.
   */
  getTargetAllocation(userId: string): TargetAllocationResponseDto {
    const config = this.getConfigOrThrow(userId);
    return {
      userId,
      allocations: config.allocations,
      driftThresholdPercent: config.driftThresholdPercent,
      autoRebalance: config.autoRebalance,
      updatedAt: config.updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DRIFT DETECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Analyse current drift without generating a trade plan.
   */
  async analyzeDrift(userId: string): Promise<DriftAnalysisDto> {
    const config = this.getConfigOrThrow(userId);
    return this.allocationAnalyzer.analyzeDrift(
      userId,
      config.allocations,
      config.driftThresholdPercent,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REBALANCING PLAN GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build a full rebalancing plan for the user.
   * If `autoExecute` is true (or auto-rebalance is configured) the trades are
   * submitted immediately; otherwise the plan is saved pending approval.
   */
  async createRebalancingPlan(
    userId: string,
    autoExecute = false,
  ): Promise<RebalancingPlanDto> {
    const config = this.getConfigOrThrow(userId);

    // 1. Analyse drift
    const drift = await this.allocationAnalyzer.analyzeDrift(
      userId,
      config.allocations,
      config.driftThresholdPercent,
    );

    // 2. Short-circuit if no rebalancing required
    if (!drift.rebalancingRequired) {
      this.logger.log(`No rebalancing required for user ${userId} (max drift ${drift.maxDriftPercent.toFixed(2)}%)`);
      return this.buildSkippedPlan(userId, drift);
    }

    // 3. Compute trades
    const proposedTrades = this.buildTrades(drift.currentAllocations, drift.portfolioValueUsd);

    const totalEstimatedFeeUsd = proposedTrades.reduce(
      (sum, t) => sum + t.estimatedFeeUsd,
      0,
    );

    const plan: RebalancingPlanDto = {
      planId: uuidv4(),
      userId,
      createdAt: new Date(),
      portfolioValueUsd: drift.portfolioValueUsd,
      currentAllocations: drift.currentAllocations,
      proposedTrades,
      totalEstimatedFeeUsd,
      rebalancingRequired: true,
      maxDriftPercent: drift.maxDriftPercent,
      status: RebalancingStatus.PENDING_APPROVAL,
    };

    // 4. Execute immediately or store for approval
    const shouldAutoExecute = autoExecute || config.autoRebalance;
    if (shouldAutoExecute) {
      plan.status = RebalancingStatus.EXECUTING;
      const execResult = await this.executePlan(userId, plan);
      plan.executionResult = execResult;
      plan.status =
        execResult.tradesFailed === 0
          ? RebalancingStatus.COMPLETED
          : RebalancingStatus.FAILED;
      this.logger.log(
        `Auto-rebalancing complete for ${userId}: executed=${execResult.tradesExecuted}, failed=${execResult.tradesFailed}`,
      );
    } else {
      // Keep plan pending manual approval
      this.pendingPlans.set(plan.planId, plan);
      this.logger.log(`Rebalancing plan ${plan.planId} pending approval for user ${userId}`);
    }

    return plan;
  }

  /**
   * Approve and execute a previously-generated pending plan.
   */
  async approvePlan(userId: string, planId: string): Promise<RebalancingPlanDto> {
    const plan = this.pendingPlans.get(planId);
    if (!plan) {
      throw new NotFoundException(`Rebalancing plan ${planId} not found`);
    }
    if (plan.userId !== userId) {
      throw new BadRequestException('Plan does not belong to this user');
    }
    if (plan.status !== RebalancingStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Plan is not pending approval (status: ${plan.status})`);
    }

    plan.status = RebalancingStatus.EXECUTING;
    const execResult = await this.executePlan(userId, plan);
    plan.executionResult = execResult;
    plan.status =
      execResult.tradesFailed === 0
        ? RebalancingStatus.COMPLETED
        : RebalancingStatus.FAILED;

    this.pendingPlans.delete(planId);
    return plan;
  }

  /**
   * List all pending plans for a user (awaiting approval).
   */
  getPendingPlans(userId: string): RebalancingPlanDto[] {
    return Array.from(this.pendingPlans.values()).filter(
      (p) => p.userId === userId && p.status === RebalancingStatus.PENDING_APPROVAL,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculate the exact amount to buy or sell for each asset so that post-trade
   * the allocation matches the target.
   *
   * Formula:
   *   targetValue  = portfolioValue × targetPercentage / 100
   *   tradeAmount  = targetValue - currentValue          (positive → buy, negative → sell)
   */
  private buildTrades(
    states: AssetAllocationStateDto[],
    portfolioValueUsd: number,
  ): RebalancingTradeDto[] {
    const trades: RebalancingTradeDto[] = [];

    for (const state of states) {
      if (!state.requiresRebalancing) continue;

      const targetValueUsd = (portfolioValueUsd * state.targetPercentage) / 100;
      const deltaUsd = targetValueUsd - state.currentValue; // positive = buy, negative = sell

      if (Math.abs(deltaUsd) < MIN_TRADE_VALUE_USD) {
        this.logger.debug(
          `Skipping dust trade for ${state.assetCode}: Δ$${deltaUsd.toFixed(4)} < $${MIN_TRADE_VALUE_USD}`,
        );
        continue;
      }

      const action: RebalancingTradeAction =
        deltaUsd > 0 ? RebalancingTradeAction.BUY : RebalancingTradeAction.SELL;

      const estimatedValueUsd = Math.abs(deltaUsd);
      const estimatedFeeUsd = estimatedValueUsd * FEE_RATE;
      // Treat current price-per-unit as currentValue / currentQuantity
      // If no current value, estimate amount directly from USD delta (price=1 fallback)
      const pricePerUnit = state.currentValue > 0
        ? state.currentValue / Math.max(state.currentValue, 1) // normalised
        : 1;
      const amount = estimatedValueUsd / (pricePerUnit > 0 ? pricePerUnit : 1);

      const driftReduction =
        (Math.abs(state.driftPercent) * estimatedValueUsd) /
        Math.max(portfolioValueUsd, 1);

      trades.push({
        assetCode: state.assetCode,
        assetIssuer: state.assetIssuer,
        action,
        amount,
        estimatedValueUsd,
        counterAssetCode: COUNTER_ASSET_CODE,
        counterAssetIssuer: COUNTER_ASSET_ISSUER,
        estimatedFeeUsd,
        driftReduction,
      });
    }

    // Sells before buys: free up USDC first to fund purchases
    trades.sort((a, b) => {
      if (a.action === RebalancingTradeAction.SELL && b.action === RebalancingTradeAction.BUY) return -1;
      if (a.action === RebalancingTradeAction.BUY && b.action === RebalancingTradeAction.SELL) return 1;
      return b.estimatedValueUsd - a.estimatedValueUsd;
    });

    return trades;
  }

  /**
   * Execute all trades in the plan against the Stellar network.
   * Uses the Trade repository as the persistence layer and simulates
   * on-chain submission (replace with MarketOrderService in production).
   */
  private async executePlan(
    userId: string,
    plan: RebalancingPlanDto,
  ): Promise<RebalancingExecutionResultDto> {
    const result: RebalancingExecutionResultDto = {
      executedAt: new Date(),
      tradesExecuted: 0,
      tradesFailed: 0,
      totalFeesPaidUsd: 0,
      transactionHashes: [],
      errors: [],
    };

    for (const trade of plan.proposedTrades) {
      try {
        const txHash = await this.submitRebalancingTrade(userId, trade);
        result.tradesExecuted++;
        result.totalFeesPaidUsd += trade.estimatedFeeUsd;
        result.transactionHashes.push(txHash);
        this.logger.log(
          `Rebalancing trade executed: ${trade.action} ${trade.amount.toFixed(7)} ${trade.assetCode} → tx=${txHash}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.tradesFailed++;
        result.errors?.push(`${trade.assetCode}: ${msg}`);
        this.logger.error(`Rebalancing trade failed for ${trade.assetCode}: ${msg}`);
      }
    }

    return result;
  }

  /**
   * Submit a single rebalancing trade to the Stellar SDEX.
   * In production, delegate to `MarketOrderService.executeOrder()`.
   * Here we persist a Trade record and simulate the network call.
   */
  private async submitRebalancingTrade(
    userId: string,
    trade: RebalancingTradeDto,
  ): Promise<string> {
    // Fetch current market price to populate entry price
    const priceKey = `${trade.assetCode}/${trade.counterAssetCode}`;
    const prices = await this.priceService.getMultiplePrices([priceKey]);
    const entryPrice = prices[priceKey] ?? 1;

    const tradeEntity = this.tradeRepository.create({
      userId,
      signalId: uuidv4(), // synthetic signal id for rebalancing trades
      side: trade.action === RebalancingTradeAction.BUY ? TradeSide.BUY : TradeSide.SELL,
      baseAsset: trade.assetCode,
      counterAsset: trade.counterAssetCode,
      entryPrice: entryPrice.toFixed(8),
      amount: trade.amount.toFixed(7),
      totalValue: trade.estimatedValueUsd.toFixed(8),
      feeAmount: trade.estimatedFeeUsd.toFixed(8),
      status: TradeStatus.COMPLETED,
      executedAt: new Date(),
      metadata: {
        source: 'rebalancing',
        planId: undefined, // will be set by caller if needed
        driftReduction: trade.driftReduction,
      },
    });

    await this.tradeRepository.save(tradeEntity);

    // Simulate Stellar transaction hash (replace with actual SDEX call)
    const txHash = this.generateMockTxHash();
    return txHash;
  }

  private buildSkippedPlan(userId: string, drift: DriftAnalysisDto): RebalancingPlanDto {
    return {
      planId: uuidv4(),
      userId,
      createdAt: new Date(),
      portfolioValueUsd: drift.portfolioValueUsd,
      currentAllocations: drift.currentAllocations,
      proposedTrades: [],
      totalEstimatedFeeUsd: 0,
      rebalancingRequired: false,
      maxDriftPercent: drift.maxDriftPercent,
      status: RebalancingStatus.SKIPPED,
    };
  }

  private getConfigOrThrow(userId: string): TargetConfig {
    const config = this.targetConfigs.get(userId);
    if (!config) {
      throw new NotFoundException(
        `No target allocation configured for user ${userId}. Please POST /portfolio/rebalancing/target first.`,
      );
    }
    return config;
  }

  private validateAllocationSum(allocations: AllocationItemDto[]): void {
    const total = allocations.reduce((sum, a) => sum + a.targetPercentage, 0);
    // Allow ±0.01 floating point tolerance
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(
        `Target allocations must sum to 100% (got ${total.toFixed(4)}%)`,
      );
    }

    // Check for duplicate asset codes
    const codes = allocations.map((a) => a.assetCode.toUpperCase());
    const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Duplicate asset codes in allocation: ${[...new Set(duplicates)].join(', ')}`,
      );
    }
  }

  private generateMockTxHash(): string {
    const hex = '0123456789abcdef';
    return Array.from({ length: 64 }, () => hex[Math.floor(Math.random() * 16)]).join('');
  }
}
