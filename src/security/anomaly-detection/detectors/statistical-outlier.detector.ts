import { Injectable, Logger } from '@nestjs/common';
import { StatisticalOutlierConfig, DEFAULT_CONFIG } from '../interfaces/anomaly-config.interface';
import { FEATURE_NAMES, FEATURE_COUNT, FeatureName } from '../utils/behavior-profiler';

interface FeatureStats {
  mean: number;
  std: number;
  median: number;
  mad: number;  // Median Absolute Deviation
  q1: number;
  q3: number;
}

/**
 * Statistical outlier detector combining Z-score, MAD, and IQR methods.
 *
 * Each feature is evaluated independently; the composite score is the
 * maximum normalised deviation across all features (worst-case exposure).
 *
 * Score: 0 = normal, 1 = extreme outlier.
 */
@Injectable()
export class StatisticalOutlierDetector {
  private readonly logger = new Logger(StatisticalOutlierDetector.name);

  private config: StatisticalOutlierConfig;
  private featureStats: FeatureStats[] = [];
  private _isFitted = false;

  constructor(config: Partial<StatisticalOutlierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG.statisticalOutlier, ...config };
  }

  isFitted(): boolean {
    return this._isFitted;
  }

  /**
   * Fits statistical baselines from the population of feature vectors.
   * @param data Matrix [samples × FEATURE_COUNT], values in [0,1].
   */
  fit(data: number[][]): void {
    if (data.length < this.config.minSamples) {
      this.logger.warn(
        `Statistical outlier detector requires at least ${this.config.minSamples} samples (got ${data.length})`,
      );
      return;
    }

    this.featureStats = [];

    for (let f = 0; f < FEATURE_COUNT; f++) {
      const values = data.map((row) => row[f]);
      this.featureStats.push(this.computeStats(values));
    }

    this._isFitted = true;
    this.logger.log(`Statistical outlier detector fitted on ${data.length} samples`);
  }

  /**
   * Returns anomaly score 0-1 for a single feature vector.
   *
   * Strategy:
   *  1. Z-score outlier check per feature
   *  2. MAD outlier check per feature (robust to skewed distributions)
   *  3. IQR fence check per feature
   *  Final score = weighted combination of worst-feature scores across methods.
   */
  score(sample: number[]): number {
    if (!this._isFitted || this.featureStats.length === 0) return 0.5;

    let maxScore = 0;

    for (let f = 0; f < FEATURE_COUNT; f++) {
      const stats = this.featureStats[f];
      const v = sample[f];

      const zScore = this.zScoreOutlier(v, stats);
      const madScore = this.madOutlier(v, stats);
      const iqrScore = this.iqrOutlier(v, stats);

      // Ensemble: take max of three methods for this feature
      const featureScore = Math.max(zScore, madScore, iqrScore);
      if (featureScore > maxScore) maxScore = featureScore;
    }

    return Math.max(0, Math.min(1, maxScore));
  }

  /**
   * Returns per-feature outlier scores for explainability.
   */
  featureScores(sample: number[]): Record<FeatureName, number> {
    const result = {} as Record<FeatureName, number>;

    for (let f = 0; f < FEATURE_COUNT; f++) {
      const stats = this.featureStats[f];
      const v = sample[f];
      const zScore = this.zScoreOutlier(v, stats);
      const madScore = this.madOutlier(v, stats);
      const iqrScore = this.iqrOutlier(v, stats);
      result[FEATURE_NAMES[f]] = Math.max(zScore, madScore, iqrScore);
    }

    return result;
  }

  serialize(): Record<string, unknown> {
    return { config: this.config, featureStats: this.featureStats, isFitted: this._isFitted };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = data.config as StatisticalOutlierConfig;
    this.featureStats = data.featureStats as FeatureStats[];
    this._isFitted = data.isFitted as boolean;
  }

  // ── Outlier methods ────────────────────────────────────────────────────────

  /**
   * Normalised Z-score: 0 below threshold, scales linearly above it up to 1.
   */
  private zScoreOutlier(value: number, stats: FeatureStats): number {
    if (stats.std === 0) return 0;
    const z = Math.abs(value - stats.mean) / stats.std;
    if (z <= this.config.zScoreThreshold) return 0;
    // Scale excess above threshold; cap at 3× threshold for score = 1
    return Math.min(1, (z - this.config.zScoreThreshold) / (this.config.zScoreThreshold * 2));
  }

  /**
   * MAD-based outlier (robust to outliers in training distribution).
   * Modified Z-score = 0.6745 * |x - median| / MAD
   */
  private madOutlier(value: number, stats: FeatureStats): number {
    if (stats.mad === 0) return 0;
    const modifiedZ = (0.6745 * Math.abs(value - stats.median)) / stats.mad;
    if (modifiedZ <= this.config.madThreshold) return 0;
    return Math.min(1, (modifiedZ - this.config.madThreshold) / (this.config.madThreshold * 2));
  }

  /**
   * IQR fence: flags values beyond Q1 - k*IQR or Q3 + k*IQR.
   */
  private iqrOutlier(value: number, stats: FeatureStats): number {
    const iqr = stats.q3 - stats.q1;
    if (iqr === 0) return 0;
    const lowerFence = stats.q1 - this.config.iqrMultiplier * iqr;
    const upperFence = stats.q3 + this.config.iqrMultiplier * iqr;

    if (value >= lowerFence && value <= upperFence) return 0;

    const excess = value < lowerFence
      ? (lowerFence - value) / iqr
      : (value - upperFence) / iqr;

    return Math.min(1, excess / (this.config.iqrMultiplier * 2));
  }

  // ── Statistics computation ─────────────────────────────────────────────────

  private computeStats(values: number[]): FeatureStats {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, n - 1);
    const std = Math.sqrt(variance);

    const median = this.quantile(sorted, 0.5);
    const q1 = this.quantile(sorted, 0.25);
    const q3 = this.quantile(sorted, 0.75);

    const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = this.quantile(deviations, 0.5);

    return { mean, std, median, mad, q1, q3 };
  }

  private quantile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const pos = p * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
  }
}
