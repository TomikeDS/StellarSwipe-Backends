import { Trade, TradeSide } from '../../../trades/entities/trade.entity';
import { Signal } from '../../../signals/entities/signal.entity';

/**
 * 17-dimensional trading behaviour vector per user.
 * All values normalised to [0, 1] before model ingestion.
 *
 * Dimensions:
 *  0  tradeFrequencyHourly   – trades per hour over last 24 h (capped at 20)
 *  1  avgTradeValueUsd       – mean trade size (log-scaled, capped at 1M)
 *  2  tradeValueVariance     – std dev / mean of trade sizes (CoV)
 *  3  buyToSellRatio         – #buys / (#buys + #sells) ∈ [0,1]
 *  4  uniqueAssetPairs       – distinct asset pairs traded (capped at 20)
 *  5  avgTimeBetweenTrades   – median inter-trade interval in minutes (capped at 1440)
 *  6  offHoursRatio          – fraction of trades between 00:00–06:00 UTC
 *  7  selfTradeScore         – fraction of buy/sell pairs on same asset within 2 h
 *  8  washTradingScore       – pairwise buy+sell within tight price band (0-1)
 *  9  roundTripScore         – trades that return to near-original position (0-1)
 * 10  volumeSpike            – last 1 h volume / last 30 d hourly average
 * 11  signalCorrelation      – fraction of trades executed within 5 min of a signal
 * 12  providerConcentration  – Herfindahl index of provider usage (0=diverse, 1=single)
 * 13  lossRatio              – fraction of closed trades that resulted in a loss
 * 14  unusualPnlVariance     – std dev of % PnL values (CoV normalised 0-1)
 * 15  rapidReversal          – fraction of positions held < 5 min (wash indicator)
 * 16  crossUserCorrelation   – not user-level (set to 0 by profiler, filled at scan time)
 */
export const FEATURE_NAMES = [
  'tradeFrequencyHourly',
  'avgTradeValueUsd',
  'tradeValueVariance',
  'buyToSellRatio',
  'uniqueAssetPairs',
  'avgTimeBetweenTrades',
  'offHoursRatio',
  'selfTradeScore',
  'washTradingScore',
  'roundTripScore',
  'volumeSpike',
  'signalCorrelation',
  'providerConcentration',
  'lossRatio',
  'unusualPnlVariance',
  'rapidReversal',
  'crossUserCorrelation',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export const FEATURE_COUNT = FEATURE_NAMES.length;

export interface BehaviorProfile {
  userId: string;
  featureVector: number[];
  namedFeatures: Record<FeatureName, number>;
  computedAt: Date;
  tradeCount: number;
  windowDays: number;
}

export class BehaviorProfiler {
  /**
   * Builds a normalised feature vector from a user's recent trades and signals.
   * @param trades  Recent completed/settled/failed trades (already filtered by window)
   * @param signals Signals the user's trades are linked to
   * @param windowDays The analysis window (used for frequency normalisation)
   */
  build(
    userId: string,
    trades: Trade[],
    signals: Signal[],
    windowDays = 30,
  ): BehaviorProfile {
    if (trades.length === 0) {
      return this.emptyProfile(userId, windowDays);
    }

    const now = Date.now();
    const windowMs = windowDays * 24 * 3600 * 1000;
    const last24h = trades.filter((t) => now - t.createdAt.getTime() <= 24 * 3600 * 1000);

    const values = trades.map((t) => Number(t.totalValue));
    const pnlValues = trades
      .filter((t) => t.profitLossPercentage != null)
      .map((t) => Number(t.profitLossPercentage));

    const named: Record<FeatureName, number> = {
      tradeFrequencyHourly: this.tradeFrequencyHourly(last24h),
      avgTradeValueUsd: this.normLog(this.mean(values), 1_000_000),
      tradeValueVariance: this.coefficientOfVariation(values),
      buyToSellRatio: this.buyToSellRatio(trades),
      uniqueAssetPairs: Math.min(1, this.uniquePairs(trades) / 20),
      avgTimeBetweenTrades: this.medianInterTradeInterval(trades),
      offHoursRatio: this.offHoursRatio(trades),
      selfTradeScore: this.selfTradeScore(trades),
      washTradingScore: this.washTradingScore(trades),
      roundTripScore: this.roundTripScore(trades),
      volumeSpike: this.volumeSpike(trades, windowDays),
      signalCorrelation: this.signalCorrelation(trades, signals),
      providerConcentration: this.providerConcentration(signals),
      lossRatio: this.lossRatio(trades),
      unusualPnlVariance: this.coefficientOfVariation(pnlValues),
      rapidReversal: this.rapidReversalRatio(trades),
      crossUserCorrelation: 0, // Populated by cross-user scan
    };

    const featureVector = FEATURE_NAMES.map((n) => named[n]);

    return {
      userId,
      featureVector,
      namedFeatures: named,
      computedAt: new Date(),
      tradeCount: trades.length,
      windowDays,
    };
  }

  // ── Feature computations ─────────────────────────────────────────────────

  private tradeFrequencyHourly(last24hTrades: Trade[]): number {
    const count = last24hTrades.length;
    return Math.min(1, count / (20 * 24)); // Normalise: 20 trades/h × 24h = 480
  }

  private buyToSellRatio(trades: Trade[]): number {
    if (trades.length === 0) return 0.5;
    const buys = trades.filter((t) => t.side === TradeSide.BUY).length;
    return buys / trades.length;
  }

  private uniquePairs(trades: Trade[]): number {
    return new Set(trades.map((t) => `${t.baseAsset}/${t.counterAsset}`)).size;
  }

  private medianInterTradeInterval(trades: Trade[]): number {
    if (trades.length < 2) return 1;
    const sorted = [...trades].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime()) / 60000);
    }
    const median = this.median(gaps);
    return Math.max(0, 1 - Math.min(1, median / 1440)); // 0 gap → 1; 1 day gap → 0
  }

  private offHoursRatio(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    const offHours = trades.filter((t) => {
      const h = t.createdAt.getUTCHours();
      return h >= 0 && h < 6;
    }).length;
    return offHours / trades.length;
  }

  /** Fraction of trades that have a matching opposite-side trade on the same
   *  asset pair within 2 hours — a lightweight wash-trading proxy */
  private selfTradeScore(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const WINDOW = 2 * 3600 * 1000;
    let pairs = 0;

    const buys = trades.filter((t) => t.side === TradeSide.BUY);
    const sells = trades.filter((t) => t.side === TradeSide.SELL);

    for (const buy of buys) {
      const hasMatch = sells.some(
        (sell) =>
          sell.baseAsset === buy.baseAsset &&
          sell.counterAsset === buy.counterAsset &&
          Math.abs(sell.createdAt.getTime() - buy.createdAt.getTime()) <= WINDOW,
      );
      if (hasMatch) pairs++;
    }

    return Math.min(1, pairs / Math.max(1, buys.length));
  }

  /**
   * Wash trading score: buy+sell pairs on the same asset within 2 h
   * where the prices differ by < 1%.
   */
  private washTradingScore(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const WINDOW = 2 * 3600 * 1000;
    const PRICE_DELTA = 0.01;
    let washPairs = 0;

    const buys = trades.filter((t) => t.side === TradeSide.BUY);
    const sells = trades.filter((t) => t.side === TradeSide.SELL);

    for (const buy of buys) {
      const buyPrice = Number(buy.entryPrice);
      const match = sells.find(
        (sell) =>
          sell.baseAsset === buy.baseAsset &&
          sell.counterAsset === buy.counterAsset &&
          Math.abs(sell.createdAt.getTime() - buy.createdAt.getTime()) <= WINDOW &&
          buyPrice > 0 &&
          Math.abs(Number(sell.entryPrice) - buyPrice) / buyPrice < PRICE_DELTA,
      );
      if (match) washPairs++;
    }

    return Math.min(1, washPairs / Math.max(1, buys.length));
  }

  /**
   * Round-trip score: how often a user buys then sells (or sells then buys)
   * the same asset pair at approximately the same price, netting ~0 value.
   */
  private roundTripScore(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const WINDOW = 4 * 3600 * 1000;
    const PRICE_DELTA = 0.005; // 0.5%
    let trips = 0;

    const sorted = [...trades].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (b.createdAt.getTime() - a.createdAt.getTime() > WINDOW) break;
        if (
          a.baseAsset === b.baseAsset &&
          a.counterAsset === b.counterAsset &&
          a.side !== b.side
        ) {
          const pa = Number(a.entryPrice);
          const pb = Number(b.entryPrice);
          if (pa > 0 && Math.abs(pb - pa) / pa < PRICE_DELTA) trips++;
        }
      }
    }

    return Math.min(1, trips / Math.max(1, trades.length / 2));
  }

  private volumeSpike(trades: Trade[], windowDays: number): number {
    const now = Date.now();
    const last1h = trades
      .filter((t) => now - t.createdAt.getTime() <= 3600 * 1000)
      .reduce((s, t) => s + Number(t.totalValue), 0);

    const allVolume = trades.reduce((s, t) => s + Number(t.totalValue), 0);
    const avgHourly = allVolume / (windowDays * 24);

    if (avgHourly === 0) return 0;
    return Math.min(1, last1h / (avgHourly * 10)); // 10× spike = score 1
  }

  private signalCorrelation(trades: Trade[], signals: Signal[]): number {
    if (trades.length === 0 || signals.length === 0) return 0;
    const SIGNAL_WINDOW = 5 * 60 * 1000;
    const signalTimes = signals.map((s) => s.createdAt.getTime());

    const correlated = trades.filter((t) =>
      signalTimes.some(
        (st) => Math.abs(t.createdAt.getTime() - st) <= SIGNAL_WINDOW,
      ),
    ).length;

    return correlated / trades.length;
  }

  private providerConcentration(signals: Signal[]): number {
    if (signals.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const s of signals) {
      counts.set(s.providerId, (counts.get(s.providerId) ?? 0) + 1);
    }
    // Herfindahl-Hirschman Index
    const total = signals.length;
    let hhi = 0;
    for (const count of counts.values()) {
      hhi += Math.pow(count / total, 2);
    }
    return hhi; // 1/n (max diversity) to 1 (single provider)
  }

  private lossRatio(trades: Trade[]): number {
    const closed = trades.filter((t) => t.profitLoss != null);
    if (closed.length === 0) return 0;
    const losses = closed.filter((t) => Number(t.profitLoss) < 0).length;
    return losses / closed.length;
  }

  private rapidReversalRatio(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const THRESHOLD = 5 * 60 * 1000; // 5 minutes
    const sorted = [...trades].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    let rapid = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (
        a.baseAsset === b.baseAsset &&
        a.counterAsset === b.counterAsset &&
        a.side !== b.side &&
        b.createdAt.getTime() - a.createdAt.getTime() < THRESHOLD
      ) {
        rapid++;
      }
    }
    return Math.min(1, rapid / (trades.length - 1));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private stdDev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1));
  }

  private coefficientOfVariation(arr: number[]): number {
    const m = this.mean(arr);
    if (m === 0) return 0;
    return Math.min(1, this.stdDev(arr) / Math.abs(m));
  }

  private normLog(value: number, cap: number): number {
    if (value <= 0) return 0;
    return Math.min(1, Math.log1p(value) / Math.log1p(cap));
  }

  private emptyProfile(userId: string, windowDays: number): BehaviorProfile {
    const named = Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])) as Record<FeatureName, number>;
    return {
      userId,
      featureVector: new Array(FEATURE_COUNT).fill(0),
      namedFeatures: named,
      computedAt: new Date(),
      tradeCount: 0,
      windowDays,
    };
  }
}
