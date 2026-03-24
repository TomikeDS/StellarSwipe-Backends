import { AnomalySeverity } from './anomaly-config.interface';

/**
 * Maps a composite anomaly score (0-1) to a severity level and
 * determines whether an alert should be raised.
 */
export interface DetectionThreshold {
  low: number;      // Score at or above this → LOW severity
  medium: number;   // Score at or above this → MEDIUM severity
  high: number;     // Score at or above this → HIGH severity
  critical: number; // Score at or above this → CRITICAL severity
}

export const DEFAULT_THRESHOLDS: DetectionThreshold = {
  low: 0.50,
  medium: 0.65,
  high: 0.80,
  critical: 0.92,
};

export function scoreToSeverity(
  score: number,
  thresholds: DetectionThreshold = DEFAULT_THRESHOLDS,
): AnomalySeverity | null {
  if (score >= thresholds.critical) return AnomalySeverity.CRITICAL;
  if (score >= thresholds.high) return AnomalySeverity.HIGH;
  if (score >= thresholds.medium) return AnomalySeverity.MEDIUM;
  if (score >= thresholds.low) return AnomalySeverity.LOW;
  return null; // Below detection threshold
}

/**
 * Wash trading specific thresholds.
 * A pair of buy+sell on the same asset within `windowMs` at prices within
 * `priceDeltaPercent` of each other is suspicious.
 */
export interface WashTradingThresholds {
  windowMs: number;           // How close in time (ms) — default 2h
  priceDeltaPercent: number;  // Max price difference % — default 1%
  minPairs: number;           // Minimum circular pairs to flag — default 2
  minValueUsd: number;        // Min per-pair USD value — default 500
}

export const DEFAULT_WASH_THRESHOLDS: WashTradingThresholds = {
  windowMs: 2 * 60 * 60 * 1000,
  priceDeltaPercent: 1.0,
  minPairs: 2,
  minValueUsd: 500,
};

/**
 * Market manipulation thresholds.
 * Detects coordinated signal publishing followed by unusual price movement.
 */
export interface ManipulationThresholds {
  correlatedSignalWindow: number; // Seconds between similar signals by diff providers
  minCorrelatedProviders: number; // How many providers posting same pair at same time
  priceImpactPercent: number;     // Minimum price move post-signal to flag
  signalCopyRateMultiplier: number; // Copy rate vs average to flag as coordinated
}

export const DEFAULT_MANIPULATION_THRESHOLDS: ManipulationThresholds = {
  correlatedSignalWindow: 10 * 60,    // 10 minutes
  minCorrelatedProviders: 3,
  priceImpactPercent: 2.0,
  signalCopyRateMultiplier: 4.0,
};
