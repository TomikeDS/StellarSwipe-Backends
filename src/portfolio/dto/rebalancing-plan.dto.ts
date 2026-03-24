export enum RebalancingTradeAction {
  BUY = 'buy',
  SELL = 'sell',
}

export enum RebalancingStatus {
  PENDING_APPROVAL = 'pending_approval',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped', // drift below threshold
}

/** Current state of a single asset inside the portfolio */
export class AssetAllocationStateDto {
  assetCode!: string;
  assetIssuer?: string;
  currentValue!: number;       // USD equivalent
  currentPercentage!: number;  // As a percent of total portfolio
  targetPercentage!: number;
  driftPercent!: number;       // currentPercentage - targetPercentage
  requiresRebalancing!: boolean;
}

/** A single proposed trade within a rebalancing plan */
export class RebalancingTradeDto {
  assetCode!: string;
  assetIssuer?: string;
  action!: RebalancingTradeAction;
  /** Amount of the asset to buy/sell */
  amount!: number;
  /** Estimated value of the trade in USD */
  estimatedValueUsd!: number;
  /** Counter-asset used for the trade (usually USDC) */
  counterAssetCode!: string;
  counterAssetIssuer?: string;
  /** Expected transaction cost in USD (fee) */
  estimatedFeeUsd!: number;
  /** Net benefit: how much this trade reduces drift */
  driftReduction!: number;
}

/** Full rebalancing plan returned to caller */
export class RebalancingPlanDto {
  planId!: string;
  userId!: string;
  createdAt!: Date;

  /** Total portfolio value in USD at time of analysis */
  portfolioValueUsd!: number;

  currentAllocations!: AssetAllocationStateDto[];
  proposedTrades!: RebalancingTradeDto[];

  /** Aggregate estimated transaction costs */
  totalEstimatedFeeUsd!: number;

  /** Whether any asset exceeds the configured drift threshold */
  rebalancingRequired!: boolean;

  /** Maximum absolute drift across all assets */
  maxDriftPercent!: number;

  status!: RebalancingStatus;

  /** Set after execution attempt */
  executionResult?: RebalancingExecutionResultDto;
}

/** Result of executing the rebalancing trades */
export class RebalancingExecutionResultDto {
  executedAt!: Date;
  tradesExecuted!: number;
  tradesFailed!: number;
  totalFeesPaidUsd!: number;
  transactionHashes!: string[];
  errors?: string[];
}

/** Response wrapper for drift-check endpoint */
export class DriftAnalysisDto {
  userId!: string;
  analysedAt!: Date;
  portfolioValueUsd!: number;
  currentAllocations!: AssetAllocationStateDto[];
  maxDriftPercent!: number;
  driftThresholdPercent!: number;
  rebalancingRequired!: boolean;
}

/** Query DTO to trigger a rebalancing run */
export class ExecuteRebalancingDto {
  /** If true, actually submit trades. If false, return plan for approval. */
  autoExecute?: boolean;
}
