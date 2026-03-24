import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signal } from '../../signals/entities/signal.entity';
import { ProviderStats } from '../../signals/entities/provider-stats.entity';
import { PriceOracleService } from '../../prices/price-oracle.service';
import { StatisticalAnalysisService } from '../../analytics/services/statistical-analysis.service';

export interface SignalFeatures {
  providerWinRate: number;
  providerReputation: number;
  providerConsistency: number;
  assetVolatility: number;
  marketTrend: number; // 1: bull, 0: neutral, -1: bear
  timeOfDay: number; // 0-1
  signalConfidence: number; // 0-1
}

@Injectable()
export class FeatureEngineeringService {

  constructor(
    @InjectRepository(ProviderStats)
    private providerStatsRepository: Repository<ProviderStats>,
    private priceOracleService: PriceOracleService,
    private statisticalAnalysisService: StatisticalAnalysisService,
  ) {}

  async extractFeatures(signal: Signal): Promise<SignalFeatures> {
    const providerStats = await this.providerStatsRepository.findOne({
      where: { providerId: signal.providerId },
    });

    const assetPair = `${signal.baseAsset}/${signal.counterAsset}`;
    const priceHistory = await this.priceOracleService.getPriceHistory(assetPair, 24);
    
    const prices = priceHistory.map(p => Number(p.price));
    const volatility = this.statisticalAnalysisService.calculateStandardDeviation(prices);
    
    // Simple market trend calculation based on last 24h
    const trend = this.calculateTrend(prices);

    return {
      providerWinRate: providerStats ? Number(providerStats.winRate) / 100 : 0.5,
      providerReputation: providerStats ? Number(providerStats.reputationScore) / 100 : 0.5,
      providerConsistency: providerStats ? this.calculateConsistency(providerStats) : 0.5,
      assetVolatility: volatility,
      marketTrend: trend,
      timeOfDay: signal.createdAt.getHours() / 24,
      signalConfidence: signal.confidenceScore / 100,
    };
  }

  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0;
    const first = prices[prices.length - 1]; // Oldest
    const last = prices[0]; // Newest
    const change = (last - first) / first;
    
    if (change > 0.02) return 1; // Bull
    if (change < -0.02) return -1; // Bear
    return 0; // Neutral
  }

  private calculateConsistency(stats: ProviderStats): number {
    if (stats.totalSignals === 0) return 0;
    // Win rate * (1 - (abs(wins - losses) / total)) - actually let's just use streak info or something
    // For now, let's use a simplified consistency metric: 1 - 1 / (streakWins + streakLosses + 1)
    const streakFactor = Math.abs(stats.streakWins - stats.streakLosses) / 10;
    return Math.min(1, Number(stats.winRate) / 100 + streakFactor);
  }

  prepareFeatureTensor(features: SignalFeatures): number[] {
    return [
      features.providerWinRate,
      features.providerReputation,
      features.providerConsistency,
      features.assetVolatility,
      features.marketTrend,
      features.timeOfDay,
      features.signalConfidence,
    ];
  }
}
