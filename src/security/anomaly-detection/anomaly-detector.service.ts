import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { Trade, TradeStatus } from '../../trades/entities/trade.entity';
import { Signal } from '../../signals/entities/signal.entity';
import { Anomaly } from './entities/anomaly.entity';
import { FraudAlert, FraudAlertStatus } from './entities/fraud-alert.entity';
import {
  AnomalyCategory,
  AnomalySeverity,
  DetectorType,
  DEFAULT_CONFIG,
} from './interfaces/anomaly-config.interface';
import { scoreToSeverity, DEFAULT_THRESHOLDS } from './interfaces/detection-threshold.interface';
import { BehaviorProfiler, BehaviorProfile } from './utils/behavior-profiler';
import { RiskCalculator } from './utils/risk-calculator';
import { IsolationForestDetector } from './detectors/isolation-forest.detector';
import { AutoencoderDetector } from './detectors/autoencoder.detector';
import { StatisticalOutlierDetector } from './detectors/statistical-outlier.detector';
import { RiskScoreDto } from './dto/risk-score.dto';
import { AnomalyReportDto } from './dto/anomaly-report.dto';

const CACHE_TTL_RISK = 60 * 5;      // 5 minutes
const CACHE_TTL_PROFILE = 60 * 15;  // 15 minutes
const TRAINING_WINDOW_DAYS = 30;
const MIN_TRAINING_SAMPLES = 50;

@Injectable()
export class TradingAnomalyDetectorService implements OnModuleInit {
  private readonly logger = new Logger(TradingAnomalyDetectorService.name);

  private readonly profiler = new BehaviorProfiler();
  private readonly isoForest = new IsolationForestDetector(DEFAULT_CONFIG.isolationForest);
  private readonly autoencoder = new AutoencoderDetector(DEFAULT_CONFIG.autoencoder);
  private readonly statOutlier = new StatisticalOutlierDetector(DEFAULT_CONFIG.statisticalOutlier);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(Signal)
    private readonly signalRepo: Repository<Signal>,
    @InjectRepository(Anomaly)
    private readonly anomalyRepo: Repository<Anomaly>,
    @InjectRepository(FraudAlert)
    private readonly alertRepo: Repository<FraudAlert>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.trainModels().catch((err) =>
      this.logger.warn(`Initial model training skipped: ${err.message}`),
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Compute the ensemble anomaly score for a user and persist anomaly records
   * for any features exceeding the detection threshold.
   */
  async scanUser(userId: string): Promise<AnomalyReportDto[]> {
    const profile = await this.buildProfile(userId);
    if (profile.tradeCount < 5) return []; // Not enough data

    const detectorScores = new Map<DetectorType, number>();

    detectorScores.set(
      DetectorType.ISOLATION_FOREST,
      this.isoForest.isFitted() ? this.isoForest.score(profile.featureVector) : 0.5,
    );
    detectorScores.set(
      DetectorType.AUTOENCODER,
      this.autoencoder.isFitted() ? this.autoencoder.score(profile.featureVector) : 0.5,
    );
    detectorScores.set(
      DetectorType.STATISTICAL_OUTLIER,
      this.statOutlier.isFitted() ? this.statOutlier.score(profile.featureVector) : 0.5,
    );

    const risk = RiskCalculator.computeEnsembleScore(detectorScores);
    if (risk.severity === null) return []; // Below threshold — normal

    const featureContributions = this.buildFeatureContributions(profile);
    const topFeatures = RiskCalculator.topFeatures(profile.featureVector, featureContributions);
    risk.topFeatures = topFeatures;

    const category = this.classifyCategory(profile);
    const anomaly = await this.persistAnomaly(userId, profile, risk, category, featureContributions);

    await this.cache.del(`risk:${userId}`);

    return [this.toAnomalyReportDto(anomaly, risk.normalizedScore)];
  }

  /**
   * Get the current risk score for a user (cached).
   */
  async getUserRiskScore(userId: string): Promise<RiskScoreDto> {
    const cacheKey = `risk:${userId}`;
    const cached = await this.cache.get<RiskScoreDto>(cacheKey);
    if (cached) return cached;

    const [openAlerts, recentAnomalies] = await Promise.all([
      this.alertRepo.find({
        where: { userId, status: FraudAlertStatus.OPEN },
        select: ['id', 'riskScore'],
      }),
      this.anomalyRepo.find({
        where: {
          userId,
          detectedAt: MoreThan(new Date(Date.now() - 7 * 24 * 3600 * 1000)),
        },
        select: ['id'],
      }),
    ]);

    const profile = await this.buildProfile(userId);
    const detectorScores = new Map<DetectorType, number>();

    detectorScores.set(
      DetectorType.ISOLATION_FOREST,
      this.isoForest.isFitted() ? this.isoForest.score(profile.featureVector) : 0,
    );
    detectorScores.set(
      DetectorType.AUTOENCODER,
      this.autoencoder.isFitted() ? this.autoencoder.score(profile.featureVector) : 0,
    );
    detectorScores.set(
      DetectorType.STATISTICAL_OUTLIER,
      this.statOutlier.isFitted() ? this.statOutlier.score(profile.featureVector) : 0,
    );

    const risk = RiskCalculator.computeEnsembleScore(detectorScores);
    const featureContributions = this.buildFeatureContributions(profile);
    const aggregatedScore = RiskCalculator.aggregateUserRisk(openAlerts as any, recentAnomalies as any);

    const dto: RiskScoreDto = {
      userId,
      score: Math.max(risk.score, aggregatedScore),
      severity: risk.severity,
      detectorScores: risk.detectorContributions.map((c) => ({
        detector: c.detector,
        score: c.score,
        weight: c.weight,
      })),
      topFeatures: RiskCalculator.topFeatures(profile.featureVector, featureContributions),
      openAlerts: openAlerts.length,
      recentAnomalies: recentAnomalies.length,
      computedAt: new Date(),
    };

    await this.cache.set(cacheKey, dto, CACHE_TTL_RISK);
    return dto;
  }

  /**
   * (Re-)trains all three detectors on recent population-wide trade data.
   * Called on startup and by the weekly retrain cron job.
   */
  async trainModels(): Promise<void> {
    this.logger.log('Fetching training data for anomaly detectors…');

    const cutoff = new Date(Date.now() - TRAINING_WINDOW_DAYS * 24 * 3600 * 1000);

    // Get distinct users who traded in the window
    const userRows: { userId: string }[] = await this.tradeRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.user_id', 'userId')
      .where('t.created_at >= :cutoff', { cutoff })
      .andWhere('t.status IN (:...statuses)', {
        statuses: [TradeStatus.SETTLED, TradeStatus.COMPLETED, TradeStatus.FAILED],
      })
      .getRawMany();

    if (userRows.length < MIN_TRAINING_SAMPLES) {
      this.logger.warn(
        `Not enough users for training: ${userRows.length} (min ${MIN_TRAINING_SAMPLES})`,
      );
      return;
    }

    // Build feature vectors for all users (in batches to avoid memory pressure)
    const BATCH = 100;
    const matrix: number[][] = [];

    for (let i = 0; i < userRows.length; i += BATCH) {
      const batchIds = userRows.slice(i, i + BATCH).map((r) => r.userId);
      const vectors = await Promise.all(batchIds.map((uid) => this.buildProfile(uid)));
      vectors.forEach((p) => {
        if (p.tradeCount >= 5) matrix.push(p.featureVector);
      });
    }

    if (matrix.length < MIN_TRAINING_SAMPLES) {
      this.logger.warn(`Insufficient qualified profiles for training: ${matrix.length}`);
      return;
    }

    this.logger.log(`Training anomaly detectors on ${matrix.length} user profiles…`);
    this.isoForest.fit(matrix);
    this.autoencoder.fit(matrix);
    this.statOutlier.fit(matrix);

    this.logger.log('All anomaly detectors trained successfully');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async buildProfile(userId: string): Promise<BehaviorProfile> {
    const cacheKey = `profile:${userId}`;
    const cached = await this.cache.get<BehaviorProfile>(cacheKey);
    if (cached) return cached;

    const cutoff = new Date(Date.now() - TRAINING_WINDOW_DAYS * 24 * 3600 * 1000);

    const [trades, signals] = await Promise.all([
      this.tradeRepo.find({
        where: {
          userId,
          createdAt: MoreThan(cutoff),
        } as any,
        order: { createdAt: 'ASC' },
      }),
      this.signalRepo.find({
        where: { createdAt: MoreThan(cutoff) } as any,
        order: { createdAt: 'ASC' },
      }),
    ]);

    const profile = this.profiler.build(userId, trades, signals, TRAINING_WINDOW_DAYS);
    await this.cache.set(cacheKey, profile, CACHE_TTL_PROFILE);
    return profile;
  }

  private buildFeatureContributions(profile: BehaviorProfile): Record<string, number> {
    const contributions: Record<string, number> = {};

    // Isolation Forest split importance
    if (this.isoForest.isFitted()) {
      const fi = this.isoForest.featureImportance();
      for (const [name, val] of Object.entries(fi)) {
        contributions[name] = (contributions[name] ?? 0) + val * 0.4;
      }
    }

    // Autoencoder per-feature reconstruction error
    if (this.autoencoder.isFitted()) {
      const errors = this.autoencoder.featureContributions(profile.featureVector);
      const total = errors.reduce((s, e) => s + e, 0) || 1;
      errors.forEach((e, i) => {
        const name = profile.featureVector[i] !== undefined
          ? Object.keys(profile.namedFeatures)[i]
          : '';
        if (name) contributions[name] = (contributions[name] ?? 0) + (e / total) * 0.35;
      });
    }

    // Statistical per-feature outlier scores
    if (this.statOutlier.isFitted()) {
      const scores = this.statOutlier.featureScores(profile.featureVector);
      for (const [name, val] of Object.entries(scores)) {
        contributions[name] = (contributions[name] ?? 0) + val * 0.25;
      }
    }

    return contributions;
  }

  private classifyCategory(profile: BehaviorProfile): AnomalyCategory {
    const f = profile.namedFeatures;

    if (f.washTradingScore > 0.6 || f.selfTradeScore > 0.6) {
      return AnomalyCategory.WASH_TRADING;
    }
    if (f.roundTripScore > 0.6) {
      return AnomalyCategory.MARKET_MANIPULATION;
    }
    if (f.volumeSpike > 0.8) {
      return AnomalyCategory.VOLUME_ANOMALY;
    }
    if (f.rapidReversal > 0.6) {
      return AnomalyCategory.PUMP_AND_DUMP;
    }
    if (f.signalCorrelation > 0.8 && f.providerConcentration > 0.8) {
      return AnomalyCategory.COORDINATED_ACTIVITY;
    }
    return AnomalyCategory.UNUSUAL_TRADING_PATTERN;
  }

  private async persistAnomaly(
    userId: string,
    profile: BehaviorProfile,
    risk: ReturnType<typeof RiskCalculator.computeEnsembleScore>,
    category: AnomalyCategory,
    featureContributions: Record<string, number>,
  ): Promise<Anomaly> {
    const severity = risk.severity as AnomalySeverity;
    const description = this.buildDescription(category, profile, severity);

    const anomaly = this.anomalyRepo.create({
      userId,
      detectorType: DetectorType.ISOLATION_FOREST, // Primary — ensemble result tagged to IF
      category,
      severity,
      anomalyScore: risk.normalizedScore,
      ensembleScore: risk.normalizedScore,
      featureVector: profile.featureVector,
      description,
      evidence: {
        namedFeatures: profile.namedFeatures,
        detectorContributions: risk.detectorContributions,
        tradeCount: profile.tradeCount,
        windowDays: profile.windowDays,
      },
      featureContributions,
      relatedTradeIds: [],
      relatedSignalIds: [],
      fraudAlertId: null,
      isFalsePositive: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      detectedAt: new Date(),
    });

    return this.anomalyRepo.save(anomaly);
  }

  private buildDescription(
    category: AnomalyCategory,
    profile: BehaviorProfile,
    severity: AnomalySeverity,
  ): string {
    const f = profile.namedFeatures;
    switch (category) {
      case AnomalyCategory.WASH_TRADING:
        return (
          `Potential wash trading detected: wash score ${(f.washTradingScore * 100).toFixed(0)}%, ` +
          `self-trade score ${(f.selfTradeScore * 100).toFixed(0)}%.`
        );
      case AnomalyCategory.MARKET_MANIPULATION:
        return `Possible market manipulation: round-trip score ${(f.roundTripScore * 100).toFixed(0)}%.`;
      case AnomalyCategory.VOLUME_ANOMALY:
        return `Abnormal trading volume: ${(f.volumeSpike * 10).toFixed(1)}× hourly average.`;
      case AnomalyCategory.PUMP_AND_DUMP:
        return `Rapid reversal pattern: ${(f.rapidReversal * 100).toFixed(0)}% of trades reversed within 5 min.`;
      case AnomalyCategory.COORDINATED_ACTIVITY:
        return (
          `Coordinated activity: ${(f.signalCorrelation * 100).toFixed(0)}% signal-correlated trades ` +
          `from a single provider (concentration ${(f.providerConcentration * 100).toFixed(0)}%).`
        );
      default:
        return `Unusual trading pattern detected with ${severity} severity ensemble score.`;
    }
  }

  private toAnomalyReportDto(anomaly: Anomaly, ensembleScore: number): AnomalyReportDto {
    return {
      anomalyId: anomaly.id,
      userId: anomaly.userId,
      detectorType: anomaly.detectorType,
      category: anomaly.category,
      severity: anomaly.severity,
      anomalyScore: anomaly.anomalyScore,
      ensembleScore,
      description: anomaly.description,
      relatedTradeIds: anomaly.relatedTradeIds,
      relatedSignalIds: anomaly.relatedSignalIds,
      evidence: anomaly.evidence,
      featureContributions: anomaly.featureContributions ?? undefined,
      fraudAlertId: anomaly.fraudAlertId ?? undefined,
      detectedAt: anomaly.detectedAt,
    };
  }
}
