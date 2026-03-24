import { AnomalySeverity, DetectorType } from '../interfaces/anomaly-config.interface';
import { scoreToSeverity, DEFAULT_THRESHOLDS } from '../interfaces/detection-threshold.interface';
import { FraudAlert } from '../entities/fraud-alert.entity';
import { Anomaly } from '../entities/anomaly.entity';
import { FEATURE_NAMES, FeatureName } from './behavior-profiler';

export interface DetectorContribution {
  detector: DetectorType;
  score: number;
  weight: number;
}

export interface CompositeRiskResult {
  score: number;            // 0-100 integer
  normalizedScore: number;  // 0-1
  severity: AnomalySeverity | null;
  detectorContributions: DetectorContribution[];
  topFeatures: Array<{ feature: FeatureName; contribution: number; value: number }>;
}

const ENSEMBLE_WEIGHTS: Record<DetectorType, number> = {
  [DetectorType.ISOLATION_FOREST]: 0.40,
  [DetectorType.AUTOENCODER]: 0.35,
  [DetectorType.STATISTICAL_OUTLIER]: 0.25,
};

// Features considered highest-risk for fraud/manipulation
const HIGH_RISK_FEATURES: FeatureName[] = [
  'washTradingScore',
  'roundTripScore',
  'selfTradeScore',
  'rapidReversal',
  'volumeSpike',
];

export class RiskCalculator {
  /**
   * Computes a composite risk score from individual detector anomaly scores.
   */
  static computeEnsembleScore(
    detectorScores: Map<DetectorType, number>,
  ): CompositeRiskResult {
    const contributions: DetectorContribution[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [detector, score] of detectorScores.entries()) {
      const weight = ENSEMBLE_WEIGHTS[detector] ?? 0;
      contributions.push({ detector, score, weight });
      weightedSum += score * weight;
      totalWeight += weight;
    }

    const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const severity = scoreToSeverity(normalizedScore, DEFAULT_THRESHOLDS);

    return {
      score: Math.round(normalizedScore * 100),
      normalizedScore,
      severity,
      detectorContributions: contributions,
      topFeatures: [], // Populated by caller with feature contributions
    };
  }

  /**
   * Extracts the top-N features that most contributed to an anomaly score.
   */
  static topFeatures(
    featureVector: number[],
    featureContributions: Record<string, number> | null,
    topN = 5,
  ): Array<{ feature: FeatureName; contribution: number; value: number }> {
    if (!featureContributions) {
      // Fall back to raw feature values weighted by known high-risk features
      return HIGH_RISK_FEATURES.slice(0, topN).map((f) => ({
        feature: f,
        contribution: featureVector[FEATURE_NAMES.indexOf(f)] ?? 0,
        value: featureVector[FEATURE_NAMES.indexOf(f)] ?? 0,
      }));
    }

    return Object.entries(featureContributions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([name, contribution]) => ({
        feature: name as FeatureName,
        contribution,
        value: featureVector[FEATURE_NAMES.indexOf(name as FeatureName)] ?? 0,
      }));
  }

  /**
   * Aggregates risk across multiple open fraud alerts for a user.
   * Uses max-pooling + penalty for each additional open alert.
   */
  static aggregateUserRisk(
    alerts: FraudAlert[],
    recentAnomalies: Anomaly[],
  ): number {
    if (alerts.length === 0 && recentAnomalies.length === 0) return 0;

    const baseScore = alerts.length > 0
      ? Math.max(...alerts.map((a) => a.riskScore))
      : 0;

    // Each additional open alert adds 5 points (capped)
    const alertPenalty = Math.min(20, (alerts.length - 1) * 5);
    // Recent anomaly volume adds up to 10 extra points
    const anomalyPenalty = Math.min(10, recentAnomalies.length * 2);

    return Math.min(100, baseScore + alertPenalty + anomalyPenalty);
  }

  /**
   * Maps a wash-trading score to a human-readable severity string
   * factoring in trade count and total value.
   */
  static washTradingRiskLevel(
    washScore: number,
    tradeCount: number,
    totalValueUsd: number,
  ): AnomalySeverity | null {
    if (washScore < 0.2) return null;
    if (washScore >= 0.8 && totalValueUsd >= 10_000) return AnomalySeverity.CRITICAL;
    if (washScore >= 0.6 || totalValueUsd >= 50_000) return AnomalySeverity.HIGH;
    if (washScore >= 0.4 || tradeCount >= 20) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  /**
   * Interprets the detector-type raw score into a 0-100 integer,
   * handling different score ranges per detector.
   */
  static normalizeDetectorScore(
    rawScore: number,
    detector: DetectorType,
  ): number {
    switch (detector) {
      case DetectorType.ISOLATION_FOREST:
        // Raw score is already 0-1 (anomaly score)
        return Math.round(rawScore * 100);
      case DetectorType.AUTOENCODER:
        // Reconstruction error — already normalised to 0-1 percentile
        return Math.round(rawScore * 100);
      case DetectorType.STATISTICAL_OUTLIER:
        // Combined z-score/MAD metric normalised to 0-1
        return Math.round(rawScore * 100);
      default:
        return Math.round(rawScore * 100);
    }
  }
}
